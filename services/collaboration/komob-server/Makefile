VIRTUALENV = virtualenv
PYTHON = bin/python
PIP = bin/pip

.PHONY: all build clean

all: clean build

build:
	$(VIRTUALENV) --no-site-packages --distribute .
	$(PIP) install -e ./
	$(PIP) install -e externals/redisco/
	$(PIP) install -e svn+https://svn.activestate.com/repos/activestate/webops/activeapis/tags/2.0.30/ --src=lib/

clean:
	- $(PIP) uninstall -y redisco
	# PIP doesn't like multiple egg-infos, so delete it manually. This sucks.
	- rm -rf externals/redisco/redisco.egg-info
	- $(PIP) uninstall -y KomobServer
	rm -rf bin include lib lib64