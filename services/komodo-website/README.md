# komodo-website
The official Komodo IDE and Komodo Edit website

# Running it

You need Ruby 1.9 or above. 

```
bundle install
export KO_QA="true"
export GITHUB_ID="username"
export GITHUB_SECRET="password"
middleman resources
middleman server
```

You only need to run `middleman resources` when you want to pull in the latest resources/packages. 

The export stuff for GITHUB is to authenticate witht he API, and only necessary if you intend to run `middleman resources`

When running `middleman server` you can access the site from `http://dev.komodoide.com:4567`

# Running it with DOCKER

Build the image:
 $ docker build --rm . -t komodo-website
Start the image:
 $ docker run -d --env komodo-website

### Docker Run Trouble

If you get an error about hitting github api limits when you `docker run` you'll need to get a
`GITHUB_ID` and `GITHUB_SECRET` from your [Github account settings](https://github.com/settings/developers).
You can set them as env vars in your terminal then pass them into the running container like so:
 $ ocker run -d --env GITHUB_ID=$GITHUB_ID --env GITHUB_SECRET=$GITHUB_SECRET komodo-website