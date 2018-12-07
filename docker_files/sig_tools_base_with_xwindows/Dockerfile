FROM cmap/matlib:latest

LABEL maintainer.clue.io="cmap-soft@broadinstitute.org"
LABEL base.sig_tools_x.clue.io.version="0.0.1"
LABEL base.sig_tools_x.clue.io.vendor="Connectivity Map"

###INSTALL X Libraries
RUN apt-get update && apt-get upgrade -y && apt-get install -y libxt6 libxt-dev libxext6 libxmu6 libxrandr2

RUN mkdir -p /out
