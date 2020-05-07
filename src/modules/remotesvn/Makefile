name = `basename $(PWD)`

all:
	zip -r $(name).jar content
	cp ../../../build/release/modules/$(name)/install.rdf .
	zip $(name).xpi $(name).jar install.rdf chrome.manifest components pylib
	rm $(name).jar

