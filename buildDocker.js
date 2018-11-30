var fs = require('fs');
var { exec } = require('child_process');
var async = require('async');

var workingDirectoryPath = process.cwd();

var sigToolName = process.argv[2];
var yamlFilepath = workingDirectoryPath + "/" + sigToolName + "/" + sigToolName + ".conf";

var readConfig = function(yaml_filepath, callback){
    fs.readFile(yaml_filepath, 'utf8', function(err, data){
        if (err){
            return callback(err)
        } else {
            return callback(null, data);
        }
    });
};
var script = [];

var chooseRum = function(){
    if (process.argv.length === 4){
        return "rum_batch.sh"
    }
    else {
        return "rum.sh"
    }
}

var main = function(next){
    var full_path = workingDirectoryPath +"/"+sigToolName;
    executeCommand("rm -fr " + full_path, workingDirectoryPath, function(err, success){
        var aws_script = [
            "mkdir " + sigToolName,
            "aws s3 cp --recursive s3://tools.clue.io/" + sigToolName + "/ "+ sigToolName +"/" ,
            "aws s3 cp s3://tools.clue.io/rum/" + chooseRum() + " " + sigToolName + "/rum.sh",
            "aws s3 cp --recursive s3://tools.clue.io/Docker/ " + sigToolName + "/"
        ];

        async.eachSeries(aws_script, function(command, callback){
            executeCommand(command, workingDirectoryPath, callback);
        }, function(err, success){
            if (err){
                console.log("failed to download assets from s3");
            } else {
                readConfig(yamlFilepath, function(err, config){
                    if (err){
                        console.log(err);
                    } else {
                        var rows = config.split("\n");
                        var dict = {};

                        for (i=0; i < rows.length; i++){
                            var pairs = rows[i].split(":");
                            dict[pairs[0]] = pairs[1];
                        }
                        //ENTRYPOINT in Docker cannot be use build-arg for replacement
                        replaceEntrypointInDockerfile(function(err, success){
                            if (err){ console.log(err)}
                        });

                        script.push("docker build --build-arg TOOL_NAME=" + sigToolName + " -t cmap/" + sigToolName + ":latest .");
                        script.push("docker build --build-arg TOOL_NAME=" + sigToolName + " -t cmap/" + sigToolName + ":v" + dict.MORTAR_REVISION + " .");
                        script.push("docker push cmap/" + sigToolName + ":latest");
                        script.push("docker push cmap/" + sigToolName + ":v" + dict.MORTAR_REVISION);

                        async.eachSeries(script, function(command, callback){
                            executeCommand(command, full_path, callback);
                        }, function(err, success){
                            next(err);
                        })

                    }
                });
            }
        })
    });
}


var executeCommand = function(command, workingDir, callback){
    exec(command, {shell:'/bin/bash', cwd:workingDir}, function(err, stdout, stderr){
        console.log("executing command: ", command);
        if (err||stderr){
            console.error(err);
            console.log(`stderr: ${stderr}`);
            return callback(err);
        }
        console.log(`stdout: ${stdout}`);
        return callback()
    })

}

var replaceEntrypointInDockerfile = function(callback){
    var dockerTemplatePath = workingDirectoryPath +'/' + sigToolName + '/Dockerfile';
    fs.readFile(dockerTemplatePath, 'utf8', function(err, dockerTemplate){
        if (err){
            return callback(err);
        } else {
            replacementString = /REPLACE_ME/g;
            dockerFile = dockerTemplate.replace(replacementString, sigToolName);
            fs.writeFile(dockerTemplatePath, dockerFile, function(err){
                if (err) {return callback(err)}
            });
            return callback()
        }
    })
}

main(function(err, success){
    if (err){
        console.log(err)
    }
    else {
        console.log("successfully built" + sigToolName)
    }
})
