require 'helpers'
helpers Helpers

#activate :imageoptim

set :url_root, "http://community.komodoide.com/"
activate :search_engine_sitemap

pageable = {}

if data.has_key? "resources"
  data.resources.categories.each do |category|
    name = category["resource"][0..-5]
    _data = data.resources["min_" + name]
    proxy "/json/packages/#{name}.json", "templates/proxy/json.json", :locals => { :data => _data }, ignore: true
    proxy "/json/packages/v10/#{name}.json", "templates/proxy/json.json", :locals => { :data => _data }, ignore: true
    proxy "/json/resources/#{name}.json", "templates/proxy/json.json", :locals => { :data => _data }, ignore: true
    
    if name == "userscripts"
        proxy "/json/packages/macros.json", "templates/proxy/json.json", :locals => { :data => _data }, ignore: true
        proxy "/json/packages/v10/macros.json", "templates/proxy/json.json", :locals => { :data => _data }, ignore: true
        proxy "/json/resources/macros.json", "templates/proxy/json.json", :locals => { :data => _data }, ignore: true
    end
    
  end
end

if data.has_key? "resources"
  all = []
  
  categories = {}
  data.resources.categories.each() do |category|
    categories[category.resource[0..-5]] = category
  end
  
  data.resources.each() do |category,resources|
    if category == 'categories'
      next
    end
    
    if category[0..3] == 'min_'
      next
    end
    
    pageable[category] = resources
    
    if ['all','downloads','popular'].include? category
      next
    end
    
    resources.each() do |resource|
      slugr = get_resource_slug(resource)
      slug = get_package_slug(resource)
      
      proxy "/resources/#{category}/#{slugr}/index.html",
            "templates/proxy/redirect.html", :locals => {
                :url => "/packages/#{category}/#{slug}/"
            }, ignore: true
            
      proxy "/packages/#{category}/#{slug}/index.html",
            "templates/proxy/resource.html", :locals => {
                :resource => resource,
                :category => categories[category],
                :page_title => resource.title
            }, ignore: true
    end
    
  end
end

# Redirects
proxy "/resources/index.html",
      "templates/proxy/redirect.html", :locals => { :url => "/packages/" }, ignore: true
      
proxy "/packages/macros/index.html",
      "templates/proxy/redirect.html", :locals => { :url => "/packages/userscripts" }, ignore: true
      
dirname = File.dirname(__FILE__)
Dir["#{dirname}/source/packages/*"].each() do |filename|
  name = File.basename(filename).gsub(/\..*$/,'')
  proxy "/resources/#{name}/index.html",
        "templates/proxy/redirect.html", :locals => { :url => "/packages/#{name}/" }, ignore: true
end

activate :pagination do
  pageable.each() do |name,data|
    pageable_set name do
      data
    end
  end
end

activate :komodo_resources

activate :directory_indexes

configure :development do
  activate :livereload, :no_swf => true
  set :is_live, false
  set :site_url, "http://dev.komodoide.com:4567"
end

configure :build do
  is_qa = ENV["KO_QA"] == "true"
  set :is_live, ! is_qa
  set :site_url, is_qa ? "http://qa.komodoide.com" : "http://community.komodoide.com"
end

set :css_dir, 'asset/stylesheets'
set :js_dir, 'asset/javascripts'
set :images_dir, 'asset/images'
set :fonts_dir, 'asset/fonts'
set :layouts_dir, "templates/layouts"
set :partials_dir, 'templates/partials'

page "*", :layout => "default"
page "json/*", :layout => false
page "asset/*", :layout => false

set :title, "Komodo IDE Community"

set :description, "Where the Komodo Community gathers. Participate on our forums,"\
                  "download or contribute packages, find out how to make Komodo your own."

set :social_description, "Check out the @KomodoIDE community!"

set :keywords, "komodo,komodo ide,activestate komodo ide,activestate komodo ide 6,"\
                "activestate komodo,activestate ide,comodo ide,activestate"\
                "comodo,kumodo ide,active state komodo,perl komodo ide,ide"\
                "software,perl ide,python ide,ide python,tcl ide,integrated"\
                "development environment,development environment,activetstate,komodo"\
                "linux,komodo mac"

set :markdown_engine, :redcarpet
set :markdown, :fenced_code_blocks => true, :smartypants => true

set :file_watcher_ignore, [
   /^bower_components(\/|$)/,
  /^\.sass-cache(\/|$)/,
  /^\.cache(\/|$)/,
  /^\.git(\/|$)/,
  /^\.gitignore$/,
  /\.DS_Store/,
  /^Gemfile$/,
  /^Gemfile\.lock$/,
  /~$/,
  /(^|\/)\.?#/,
  /^tmp\//,
  /^build(\/|$)/
]

ignore 'templates/*'

configure :build do
  activate :minify_css
  activate :minify_javascript
end

after_configuration do
  sprockets.append_path File.join root, 'bower_components'
end
