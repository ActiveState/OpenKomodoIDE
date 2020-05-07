---
title: Docker and Vagrant integration
---
(Komodo IDE only)

Komodo provides Docker and Vagrant integration through the [Shell Scope](commando.html#commando-go-to-anything_shell-scope). It effectively provides a way of working with their respective command line tools without having to execute multiple commands as a reference for the actual command that you wish to execute.

For example, I can run `docker attach` in the Commando shell scope and Commando will give me a list of all my containers, allowing me to just select the relevant container on which to execute the command rather than relying on me to just "know" this or to execute another command to find the right container id.

## Configuration
Commando tries to find docker and vagrant on your PATH, however you may wish to configure them manually if they are not on your PATH or if you have multiple versions installed. To do this navigate to the Environment preferences page and specify your custom path.
