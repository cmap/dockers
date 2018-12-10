var fs = require("fs");
var { exec } = require("child_process");
var async = require("async");

var batchTools = ["sig_gutc_tool", "sig_collategutc_tool"];

var workingDirectoryPath = process.cwd();
var sigToolName = process.argv[2];

var yamlFilepath = workingDirectoryPath + "/" + sigToolName + "/" + sigToolName + ".conf";

var readConfig = function(yaml_filepath, callback){
    fs.readFile(yaml_filepath, "utf8", function(err, configContents){
        if (err){
            return callback(err);
        } else {
            return callback(null, configContents);
        }
    });
};

var executeCommand = function(command, workingDir, callback){
    exec(command, {shell:"/bin/bash", cwd:workingDir}, function(err, stdout, stderr){
        console.log("executing command: ", command);
        if ( err || stderr ){
            console.error(err);
            console.log(`stderr: ${stderr}`);
            return callback(err);
        }
        console.log(`stdout: ${stdout}`);
        return callback();
    })

}

var replaceStringInDockerfile = function(dockerTemplatePath, replacementString, callback){
    fs.readFile(dockerTemplatePath, "utf8", function(err, dockerTemplate){
        if (err){
            return callback(err);
        } else {
            dockerFile = dockerTemplate.replace(replacementString, sigToolName);
            fs.writeFile(dockerTemplatePath, dockerFile, function(err){
                if (err) { return callback(err); }
            });
            return callback();
        }
    })
}

var main = function(next){
    var full_path = workingDirectoryPath + "/" + sigToolName;
    var isBatch = false;
    executeCommand("rm -fr " + full_path, workingDirectoryPath, function(err, success){
        var aws_script = [
            "mkdir " + sigToolName ,
            "aws s3 cp --recursive s3://tools.clue.io/" + sigToolName + "/ "+ sigToolName +"/" ,
            "aws s3 cp --recursive s3://tools.clue.io/Docker/ " + sigToolName + "/"
        ];
        if ( batchTools.includes(sigToolName) ) {
            isBatch = true;
            aws_script.push("aws s3 cp --recursive s3://tools.clue.io/DockerBatch/ " + sigToolName + "/Batch/");
        }
        async.eachSeries(aws_script, function(command, callback){
            executeCommand(command, workingDirectoryPath, callback);
        }, function(err, success){
            if (err){ console.log("failed to download assets from s3"); }
            else {
                readConfig(yamlFilepath, function(err, config){
                    if (err){ console.log(err); }

                    else {
                        //Manual conversion of config to dictionary
                        var rows = config.split("\n");
                        var dict = {};

                        for (i=0; i < rows.length; i++){
                            var pairs = rows[i].split(":");
                            dict[pairs[0]] = pairs[1];
                        }
                        //ENTRYPOINT in Docker cannot be use build-arg for replacement
                        var dockerTemplatePath = workingDirectoryPath +"/" + sigToolName + "/Dockerfile";
                        var replacementString = /REPLACE_ME/g;
                        replaceStringInDockerfile(dockerTemplatePath, replacementString, function(err, success){
                            if (err){ console.log(err); }
                        });

                        var script = [
                            "docker build --build-arg TOOL_NAME=" + sigToolName + " -t cmap/" + sigToolName + ":latest ." ,
                            "docker build --build-arg TOOL_NAME=" + sigToolName + " -t cmap/" + sigToolName + ":v" + dict.MORTAR_REVISION + " ." ,
                            "docker push cmap/" + sigToolName + ":latest" ,
                            "docker push cmap/" + sigToolName + ":v" + dict.MORTAR_REVISION
                        ];

                        if (isBatch){
                            // FROM _must_ be the first line of a Dockerfile, meaning that in order to variably pull
                            // FROM another sig_tool, we cannot use Docker build-arg
                            dockerTemplatePath = workingDirectoryPath + "/" + sigToolName + "/Batch/Dockerfile";
                            replacementString = /TOOL_NAME/g;
                            replaceStringInDockerfile(dockerTemplatePath, replacementString, function(err, success){
                                if (err) { console.log(err); }
                            });

                            //move Dockerfile and rum to cwd, overwriting non-batch files
                            script.push("mv ./Batch/* .");

                            var batchToolName = sigToolName + "_batch";
                            script.push("docker build -t cmap/" + batchToolName + ":latest");
                            script.push("docker build -t cmap/" + batchToolName + ":v" + dict.MORTAR_REVISION + " .");
                            script.push("docker push cmap/" + batchToolName + ":latest");
                            script.push("docker push cmap/" + batchToolName + ":v" + dict.MORTAR_REVISION);
                        }
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

main(function(err, success){
    if (err){
        console.log(err);
    }
    else {
        console.log("successfully built " + sigToolName);
    }
})