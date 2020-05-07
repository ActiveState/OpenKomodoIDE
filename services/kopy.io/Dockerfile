FROM ubuntu:18.04
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG nodeVer="v0.10.25"
ARG nodeDir="node-$nodeVer-linux-x64"
ARG nodeBin="$PWD/$nodeDir/bin"
ARG nodeTar="$nodeDir.tar.gz"
ARG nodeURL="https://nodejs.org/dist/$nodeVer/$nodeTar"

RUN curl -O $nodeURL
RUN tar xf $nodeTar
ENV PATH=$nodeBin:$PATH

ADD . .

RUN npm install

CMD ["npm", "start"]



