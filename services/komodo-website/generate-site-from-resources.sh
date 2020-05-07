rvm use $rubVers
rm -Rf data/resources/*
bundle install
bundle exec middleman resources
bundle exec middleman build
rm -Rf live
mv build live