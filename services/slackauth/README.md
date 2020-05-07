### Requirements
- Docker
- Git

### Setup
- Git clone this repo
- `sudo docker image build -t slackauth:1.0 .`
- retrieve the *Client ID** and **Client Secret** from the [Komodo app page](api.slack.com/apps/A29P6U8TG)
- `export SLACK_CLIENT_ID=[what you got from the apps page]` and `export SLACK_CLIENT_SECRET=[what you got from the apps page]`
- `sudo docker container run --publish 80:8080 -eSLACK_CLIENT_ID=$SLACK_CLIENT_ID -eSLACK_CLIENT_SECRET=$SLACK_CLIENT_SECRET --detach --name sa slackauth:1.0`

You'll now be able to hit localhost:8000 and get an error, `404, baby!`.  Congratulations.  You have achieved a thing.  I am proud of you.