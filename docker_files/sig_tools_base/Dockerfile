FROM ubuntu:14.04

LABEL maintainer.clue.io="cmap-soft@broadinstitute.org"
LABEL base.sig_tools.clue.io.version="0.0.1"
LABEL base.sig_tools.clue.io.vendor="Connectivity Map"

RUN apt-get update && apt-get upgrade -y && apt-get install -y wget tar unzip libXt-dev libxtst6

###INSTALL MATLAB Runtime
RUN mkdir -p /matlab_installer && mkdir -p /cmap/tools/sig_tools/mcr/versions && mkdir -p /cmap/tools/sig_tools/mcr/v84


ADD matlab_options.txt /matlab_installer/matlab_options.txt

ADD MCR_R2014b_glnxa64_installer.zip /matlab_installer/

COPY bin /cmap/tools/sig_tools/bin

WORKDIR /matlab_installer

RUN unzip MCR_R2014b_glnxa64_installer.zip && ./install -mode silent -inputFile /matlab_installer/matlab_options.txt && rm -rf /matlab_installer && cd /cmap/tools/sig_tools/mcr/versions && ln -s ../v84/ v84

env PATH /cmap/tools/sig_tools/bin:$PATH
