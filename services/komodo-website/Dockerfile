FROM nginx:1.15.4
RUN apt-get update \
  && apt-get install -qy --no-install-recommends dirmngr git curl ca-certificates procps gnupg2 build-essential  \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

# Node
ARG nodeVer="v0.10.25"
ARG nodeDir="node-$nodeVer-linux-x64"
ARG nodeBin="$PWD/$nodeDir/bin"
ARG nodeTar="$nodeDir.tar.gz"
ARG nodeURL="https://nodejs.org/dist/$nodeVer/$nodeTar"
RUN curl -O $nodeURL
RUN tar xf $nodeTar
ENV PATH=$nodeBin:$PATH
# Ruby
ARG rubVers="2.3.1"
RUN mkdir ~/.gnupg
RUN echo "disable-ipv6" >> ~/.gnupg/dirmngr.conf
RUN gpg2 --keyserver hkp://keys.gnupg.net --recv-keys D39DC0E3
RUN curl -sSL https://get.rvm.io | bash -s
RUN /bin/bash -l -c ". /etc/profile.d/rvm.sh && rvm install $rubVers"
# Site
ARG baseDir="/deployment"
ARG komodoSiteDir="$baseDir/komodo-site"
WORKDIR $komodoSiteDir
ADD . .
RUN mv nginx.conf /etc/nginx/
RUN mkdir /etc/nginx/sites-enabled
RUN cp community-sites-enabled /etc/nginx/sites-enabled/community

EXPOSE 5000
RUN echo " something"
CMD ["$komodoSiteDir/generate-site-from-resources.sh"]
# The entry point here is an initialization process, 
# it will be used as arguments for e.g.
# `docker run` command 
ENTRYPOINT ["/bin/bash", "-l", "-c"]
