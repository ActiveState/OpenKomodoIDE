---
title: Ruby on Rails Tutorial
---

(Komodo IDE only)

<a name="rails_overview" id="rails_overview"></a>
## Overview

<a name="rails_prerequisites" id="rails_prerequisites"></a>
### Before you begin

For this tutorial you will need:

- A recent local installation of [Ruby](http://www.ruby-lang.org/en/downloads/) (1.8.6 or later). See the [Debugging Ruby](/manual/debugruby.html) documentation for debugger configuration instructions.
- A local installation of [Ruby on Rails](http://www.rubyonrails.org/down) (version 2.x or later).
- The Komodo [Ruby on Rails extension](http://community.activestate.com/xpi/ruby-rails-extension).
- Access to a [MySQL](http://mysql.org/downloads/) or [SQLite](http://www.sqlite.org/) database. If using MySQL, you'll need to install a Ruby library:

    ```bash
    gem install mysql # for Rails version 2
    gem install mysql2 # for Rails version 3
    ```

Several online "how to" guides are available for installing and configuring Ruby on Rails.

<a name="rails_scenario" id="rails_scenario"></a>
### Tutorial Scenario

This tutorial walks you through the creation of a very simple Rails application. The **Movie Lending Library** application is a web application that allows you to add, remove, borrow and return movies from a shared library.

Komodo has a very powerful Ruby on Rails project extension with userscripts and commands for further automating the creation of Rails applications. The entire application can be created within Komodo using these tools and Komodo itself, without having to work at the command-line.

In this tutorial you will:

1.  Create a new Rails scaffold using the Ruby on Rails Komodo project extension.
1.  Create a MySQL database.
1.  Create the core of the application using just the project userscripts.
1.  Write some code to iteratively develop the Movie Library application.
1.  Test and debug the application.

<a name="rails_template_new" id="rails_template_new"></a>
## Creating a Rails Project

Komodo ships with a powerful extension for creating Rails projects, containing several userscripts for:

- Creating and deleting databases
- Generating controllers, migrations, models and scaffolds
- Migrating databases
- Running a built-in web server ([Mongrel](http://mongrel.rubyforge.org/), [Webrick](https://rubygems.org/gems/webrick/versions/1.3.1), or [LightHTTPD](http://www.lighttpd.net/))
- Debugging the application

When creating a new Rails project, you can tell Komodo where the Rails executable lives, and which database you prefer to use, at **Preferences** > **Languages** > **Ruby** > **Rails**. Komodo will make sure that the version of Rails matches the current version of Ruby.

To create the tutorial project file:

1. In Komodo, select **Project** > **Create Ruby on Rails Project**. Create a new directory/folder in a convenient location (e.g. `C:\rails\movielib` on Windows, or `/home/_username_/rails/movielib` on macOS or Linux). You can create a new Rails project in an existing directory, but it's advisable to not have more than one Rails project in a directory.
1. Give the file a useful name. Since this tutorial creates a movie lending library, let's call it `movielib.komodoproject`.

If Rails has been installed correctly, you should see output in the bottom pane saying `The movielib project is built`. The movielib project should open in the **Places** sidebar on the left, and should show the directories created by the `rails` command (app, components, config, db, etc.).

When you installed the Ruby on Rails extension, it added a "Ruby on Rails" toolbox in the Toolbox sidebar. You'll find the tools that carry out the most common functions for creating and managing Rails applications there. If you prefer not to keep the Toolbox sidebar open, you can access these tools by name via the **Tools** > **Invoke Tool** menu item.

Rails tools have a lot of third-party dependencies, and sometimes a new release of one of them can break the tools in the Rails project template.

<a name="rails_create_db" id="rails_create_db"></a>
## Creating the Database

<a name="rails_edit_database_yml" id="rails_edit_database_yml"></a>
### Editing the database.yml file

If you chose SQLite2 or SQLite3 as your database tool, you can skip this step. If you chose PostgreSQL or Oracle, you'll need to manage the database manually. This section applies only to MySQL users.

If MySQL is installed locally and can accept connections by 'root' without a password (it often does by default), click the **Create Databases** userscript in the **Rails Tools** project folder to create the database.

If you have set a MySQL root password, created another MySQL account that you would like to use, or are running the server on a different host, you will need to configure the `database.yml` file:

1.  Open the **config** project folder and double-click `database.yml` to open it in an editor tab.
1.  As necessary, modify the `username` and `password` values to match the configuration of your MySQL server. If you're not sure what values to use, leave the default values ('`username: root`' and '`password:` '). In this tutorial, we will only be working with the `development` database and `test` databases, but you should modify the `production` section as well to avoid seeing errors when running the **Create Databases** userscript below.
1.  If you are running MySQL on a remote server, add the setting `hostname:` _host_ to the `development:` configuration block, or modify the value if that setting is already present (set to `localhost` by default.

If you would like to use a database server other than MySQL, consult the [Rails documentation](http://www.rubyonrails.org/docs) on configuring this file, making sure you have the necessary [database drivers](http://wiki.rubyonrails.com/rails/pages/DatabaseDrivers) installed, and creating the database manually. The database userscripts in the project will only work with MySQL.

<a name="rails_create_databases_macro" id="rails_create_databases_macro"></a>
### Running the Create Databases Userscript

In the Rails Tools project folder is a userscript called **Create Databases**. Double-click the userscript to run it.

If the `database.yml` file (and the database server) are configured correctly, a database called **movielib** (as specified in the `database.yml` file - derived from the project name) will be created and an alert will appear indicating that the database creation is done.

<a name="rails_generate_scaffold" id="rails_generate_scaffold"></a>
## Creating a Scaffold

Generating a scaffold is a quick way to get a skeletal, working Rails application that can be modified iteratively. Since most database driven web applications are very similar in their basic design, Rails builds a generic application based on the information in your models which you can then modify to meet your specific requirements.

In the Generators folder, double-click the **scaffold** userscript. In the dialog box enter `movie` as the model name, and `title:string` as the only attribute in the `movie` model. Click **OK**.

A list of the files that were created and/or modified should then appear in the **Command Output** tab.

Several files are created and opened in editor tabs. You can unclutter your workspace by closing most of them. For now close all the files but `movie.rb`, `movie_tests.rb`, `movie_controller.rb`, and `movie_controller_tests.rb`. We'll return to most of the other generated files later.

<a name="rails_migration" id="rails_migration"></a>
### Migration

Now that we've defined the model in Rails, we need to apply them to our database. In Rails this is done with the `rake db:migrate` command. Again, there's a userscript to do this for us.

Double-click the **db:migrate** userscript in **Rails Tools** > **Migrate**. The **Command Output** tab should show that the `movies` table has been created.

<a name="rails_testing_basics" id="rails_testing_basics"></a>
## Testing Rails Scaffolds

At this point we have a working application. While it's tempting to start the server, switch to the browser, and try it out, we should take advantage of the testing framework built into Rails to verify that our application is working as we expect.

Let's add a couple of sanity checks to the model: we want to verify that all movie entries have a title, and that there are no duplicates. Bring up `movie.rb` and add this code at lines 2 and 3, immediately after `class Movie < ActiveRecord::Base`:

```
validates_presence_of :title
validates_uniqueness_of :title
```

You should see code-completion after you type `val` each time.

In the second line, after you type `:t` you can press the tab key to have it finish `:title`. If this does nothing verify that the "Use tab character to complete words like Ctrl+Space" setting is on under **Edit** > **Preferences** > **Editor** > **Smart Editing**.

Open `movie_test.rb`, delete the `test_truth` method that the scaffolder generated for you (this will look slightly different with Rails 3), and add these two tests:

```
def test_present
   m = Movie.new
   assert !m.valid?
   m.title = "Rocky"
   assert m.valid?
 end

 def test_unique
   m1 = Movie.create(:title => "Alien")
   assert m1.valid?
   m2 = Movie.create(:title => "Alien")
   # First film should still be valid
   assert m1.valid?
   assert !m2.valid?
   m2.title += "s"
   assert m2.valid?
 end

```

<a name="running_tests_in_komodo_ide" id="running_tests_in_komodo_ide"></a>
### Running Model Tests in Komodo IDE

**Note**: The functions described in this section currently don't work with Rails 3. If you're using Rails 3, and find running the tests generate errors, please skip to the next section.

Komodo IDE introduced unit-test integration with version 4.3. To run the unit tests click on the **Test Results** tab in the bottom window. In the test plan dropdown menu on the right side. Select "test:units", and press the **Run** button immediately to the right.

This command might fail if the Ruby and Rake executables in the system path are different from the ones you've indicated in the **Preferences** settings. In this case, you'll need to change the path environment Komodo runs in.

You should see the tests run for a few seconds, and then a list of results will appear. If you get a message along the lines of the following: "Run `rake db:migrate` to update your database then try again." you probably skipped that step above. Run the **Rails Tools/Migrate/db:migrate** userscript, and retry the tests.

The result tab should show that 2 tests passed, 0 failed, and there were 0 errors. There's also an "Information" line, where Komodo displays lines of output from the underlying test pass that might be of interest, but don't fit in any particular test.

<a name="running_tests_in_komodo_edit" id="running_tests_in_komodo_edit"></a>
### Running Tests in Komodo Edit

This tutorial assumes you're using Komodo IDE, but it's easy to follow along with Komodo Edit. You can run unit tests inside Komodo Edit with the **Rails Tools/Test/Unit Tests** userscript. This will show the results in the Command Output window. You should see a final result of:

```
2 tests, 6 assertions, 0 failures, 0 errors
```

Other commands (e.g. `rake test:functionals` below) can be run in a [Run Command](/manual/run.html).

<a name="running_controller_tests"></a>
### Running Controller Tests

While the generated model test file has one trivial test, the Rails scaffolder generates a full complement of controller tests. Bring up `movie_controller_test.rb` to have a look at them.

Click on the **Test Results** tab, select the **test:functionals** test from the drop-down list, and press the **Run** button.

This time you should see that two of the tests failed: `test_should_create_movie` and `test_should_update_movie`. If you click on the red "failures" button above the results, it will cycle through the failed tests.

The **Details** window shows the results for each test. Make sure the `test_should_create_movie` test is highlighted in the first window.

Double-click the first line of code that refers to `test/functional/movies_controller_test.rb`. `movies_controller_test.rb` should become the current file, with the cursor at the line that was reported in the traceback; in this case, line 16. We see that this code is failing:

```
assert_difference('Movie.count') do
    post :create, :movie => { }
end

```

The problem is that the controller_test's call to 'post' hits the controller's create command, which does go through the validation check. The failure to pass the check prevents a new movie from being created, and we still have two entries in the database after the block runs. Let's make a change that should satisfy the model's rules:

```
def test_should_create_movie
assert_difference('Movie.count') do
   post :create, :movie => { :title => "movie 3" }
end

```

If we rerun the test, we're now down to one failure. Click on the red failure button to move to the failed test, then double-click on the line starting with `test/functional/movies_controller_test.rb:35:in `test_should_update_movie'` in the **Details** window to see the failed code.

```
def test_should_update_movie
    put :update, :id => movies(:one).id, :movie => { }
    assert_redirected_to movie_path(assigns(:movie))
  end

```

It's not obvious why this test is failing. Rails tests are just Ruby code, so let's use the debugger Komodo IDE only to have a closer look, with the following steps:

1. Set a breakpoint at line 62 of `movies_controller.rb`, in the update routine.
1. Open `movies_controller_test.rb`
1. Start the debugger, with the **Debug** > **Go/Continue** menu item.
1. In the **Debugging Options** box, make sure the Directory field consists of the top-level directory of your project (the directory containing the `movielib.komodoproject` file, not the test file).
1. Click **OK**.
1. The debugger should stop at line 62. Now set breakpoints at lines 64 and 68, to capture the success and failure branches, and continue.
1. The debugger should stop at line 68, since this test failed. Examine the cause of failure by clicking on the **Self** tab in the **Debug: movies_controller.rb** tab, finding `@movie`, and then expanding the `.@errors` field under it. This field has another `.@errors` field, so expand that, and you'll see that the `title` field is set to `"has already been taken"`. Why?

What are those duplicate values? While the debugger is still running, enter the interactive shell with the **Debug** > **Inspect** menu command, and type the line:

```
Movie.find(:all).map(&:title)
```

Ruby should reply with `["MyString", "MyString"]`. Those values come from the file `test/fixtures/movies.yml`. The problem is that when Rails reads the fixtures file to populate the database, it doesn't run the values through ActiveRecord's validation checks. Once you start using controller methods, like the `update` method here, the values are run through validation checks.

Let's fix that. Stop the debugger and change one of those "MyString" movie titles to something more interesting, like "Who Is Harry Kellerman and Why Is He Saying Those Terrible Things About Me?", or "My Other String", if you're not up for all that typing.

The unit and functional tests should now pass.

<a name="rails_starting_app" id="rails_starting_app"></a>
## Starting the Rails Application Server

At this point we have a working application. It's not yet useful as a lending library, but we can have a look at what we've got so far.

In the Run folder, double-click the **run server** userscript. This will start one of the **Mongrel**, **lighttpd**, or **Webrick** servers, depending on your Ruby installation, and run it in a separate console window.

<a name="mongrel_issues" id="mongrel_issues"></a>
### Dealing with Mongrel

Rails now uses Mongrel as its default web server. The dependencies between different versions of Mongrel, Mongrel_Service and Rails haven't been worked out on Windows yet. If your console window exits with a `MissingSourceFile` message (along with a long traceback), you can have Rails use Webrick by editing the **Rails Tools** > **Run** > **run server** userscript (right-click -> Properties) and making the following change:

Replace the lines:

```
2: 'script/server webrick',
3: 'script/rails server webrick'
```

with:

```
2: 'script/server webrick',
3: 'script/rails server webrick'
```

<a name="testing_app_1" id="testing_app_1"></a>
### Testing the Application

Open the URL [http://localhost:3000/movies](http://localhost:3000/movies) in your favorite web browser. You should see a **Listing movies** page with no data and a **New movie** link. This is now usable, but not terribly interesting. However we can leave the web server running and see our changes as we make them.

While the application the Rails scaffolder generates is certainly serviceable, there are some tweaks that will immediately make it friendlier:

If we're going to enter a number of movies, let's speed things up by stealing the **New Movie** link from `index.erb`, and placing it in `show.erb`:

Copy the line

```
<%= link_to 'New movie', new_movie_path %>
```

from `index.erb`, and paste it at the end of `show.erb`. Put a "|" character at the end of the previous line to maintain consistency. Save `show.erb`. No need to restart the server -- switch to the app, enter a new title at the **New Movie** screen, press the "Create" button, and you should have a "New movie" link.

Similarly, it would be nice if the cursor was in the **Title** field when we load the **New movie** page, similar to how the **Search** field has the focus on Google's home page. Since we're going to be using the **Prototype** library, I added the `javascript_include_tag` directive to the head section of _app/views/layouts/movies.erb_ (Rails 3 does this already):

```
<title>Movies: <%= controller.action_name %></title>
    <%= stylesheet_link_tag 'scaffold' %>
    <%= javascript_include_tag :defaults %>

```

Then add this code to the end of `new.erb`:

```
<script type="text/javascript">
  Event.observe(window, "load", function() {
      $('movie_title').focus();
      });
  </script>

```

If you type this code in, you should see code-completion after '`Event.`' and a call-tip after '`(`' if you've enabled the `prototype.js` code intelligence [API catalog](/manual/prefs.html#code_intel) in [Preferences](/manual/prefs.html).

Again, there's no need to restart the server. As soon as you load the new controller and view code, your changes will come into effect.

<a name="installing_plugins" id="installing_plugins"></a>
## Installing Plugins

Too many software packages gain bloat as they reach higher revisions. Rails is different -- the Rails team actually dropped much of its code going from 1.2 to 2.0\. Most of the dropped functionality is still available as plugins, but now people who want it need to explicitly install it. The idea is that people who don't need a particular widget shouldn't subsidize the few who want it.

We're going to install two plugins, to handle in-place editing and pagination.

Fortunately Komodo ships with userscripts that install these plugins, and add necessary patches. Open the **Rails Tools** > **Plugins** folder in your Rails project, and run the `in-place editing` and `pagination` userscripts. If you try to install a plugin that's already installed, you'll get a warning.

It's easy to create new plugin userscripts. Every installable plugin is treated as a resource, usually in a public subversion repository, and identifiable with a URI. On the command-line you would invoke `ruby script/install plugin <URI>` for Rails v2. In Komodo you would just need to copy one of the userscripts, edit it, and replace the old URI with the new one.

Plugins need to be installed in new Rails projects that use them (i.e. the plugin is added to the specific Rails application, not to Rails itself). You have to restart the server after doing this, so this would be a good time to stop the current Rails server. Find the window it's running in, and press `Ctrl-C` (`Ctrl-Break` on Windows). We'll restart it again later.

<a name="adding_pagination" id="adding_pagination"></a>
### Adding Pagination

First we'll add pagination by making these changes to the **movie** model and controller.

In `app/controllers/movies_controller.rb`, change line 5 from:

```
@movies = Movie.find(:all)

```

to

- For Rails 2:

```
@movies = Movie.paginate(:page => params[:page])
  ```

- For Rails 3:

```
@movies = Movie.find(:all).paginate(:page => params[:page], :per_page=>Movie.per_page)
  ```

Add this code at the class level to `app/models/movie.rb` (lines 4-5):

```
cattr_reader :per_page
     @@per_page = 10

```

Finally, add pagination to the view. The last three lines of `app/views/movies/index.erb` should contain this code:

```
<%= will_paginate(@movies) %>
  <br />
  <%= link_to 'New movie', new_movie_path %>

```
<a name="testing_pagination" id="testing_pagination"></a>
### Testing Pagination

Now we could start up the server, enter a few dozen _different_ titles, and verify that the pagination is working. Or we can write another test, in `movies_controller_test.rb`:

```
def test_pagination
    Movie.delete_all
    35.times {|i| Movie.create(:title => "title #{i}")}
    get :index
    assert_tag(:tag => 'div',
               :attributes => { :class => 'pagination'})
    assert_tag(:tag => 'span',
               :content => '&laquo; Previous',
               :attributes => { :class => 'disabled'})
    assert_tag(:tag => 'span',
               :content => '1',
               :attributes => { :class => 'current'})
    assert_tag(:tag => 'div',
               :attributes => { :class => 'pagination'},
               :child => { :tag => 'a',
                 :attributes => { :href => "/movies?page=4" },
                 :content => "4" })
  end

```

Those `assert_tag` tests might look like they were pulled out of thin air, but the debugger was very useful in writing them. Originally the test read like this:

```
def test_pagination
    Movie.delete_all
    35.times {|i| Movie.create(:title => "title #{i}")}
    get :index
    assert_response :success
  end

```

We used the debugger to stop at the final line, captured the contents of `@request.body` by double-clicking on it in the **Self** tab of the **Debug** tab, and pasted it into an empty `HTML` buffer in Komodo, and found the paginator was generating this code:

```
<div class="pagination">
      <span class="disabled">&laquo; Previous</span>
      <span class="current">1</span>
      <a href="/movies?page=2">2</a>
      <a href="/movies?page=3">3</a>
      <a href="/movies?page=4">4</a>
      <a href="/movies?page=2">Next &raquo;</a>
  </div>

```

We then entered an interactive context with the **Debug** > **Inspect** menu item, found some documentation on the `assert_tag`, and interactively tried out the expressions, starting with simple expressions and making them more complex. A final set that covered the situations was then copied into the test.

<a name="using_pagination" id="using_pagination"></a>
### Testing Pagination in the Application

The functional test results should have you convinced that these additions didn't break anything. But now would be a good time to restart the server, try the application, and make sure it still works as before. If you add eleven movies you should see the paginator at work.

<a name="adding_in_place_editing" id="adding_in_place_editing"></a>
### Adding In-Place Editing

**Rails 2 only!** We haven't found a straightforward solution to supporting in-place-editing in Rails 3 yet.

Having to bring up an editing screen to change the spelling of a movie is cumbersome. This is easy to fix.

Add this code to `movies/index.erb`, replacing the **movie.title** accessor:

```
<td class="dvdlib_item">
       <% @movie = movie %>
       <%= in_place_editor_field :movie, :title %>
     </td>

```

Replace line 3 of `show.erb` with just this line:

```
<%= in_place_editor_field :movie, :title %>

```

It should replace the line that displays the movie's title in a readonly field (`<%= h(movie.title) %>`) with a user-editable field. You can also remove the link to the edit page (in the `show.erb` file as well), and remove `views/movies/edit.erb` by right-clicking its icon in the project view, selecting **Delete**, and choosing "Move to Trash".

Finally you need to tell your controller you're doing in-place editing:

On line 2 of `movies_controller.rb` add:

```
in_place_edit_for :movie, :title
   protect_from_forgery :except => [:set_movie_title]

```

Also in the controller, change the `edit` method so it doesn't go looking for the now-deleted `edit.erb` file. A quick way to find this method is with the **Sections** panel in the statusbar -- it's the text field immediately to the right of a green circle.

```
# GET /movies/1/edit
  def edit
    @movie = Movie.find(params[:id])
    respond_to do |format|
      format { render :action => "show" }
      format.xml  { render :xml => @movie }
    end
  end

```

Once again, run the unit and functional tests to verify these changes didn't break anything. They should be fine, and this would be a good time to verify their actions in the browser, especially because in-place editing is hard to verify in a functional test. Click on a movie title in the list view, and you should see the field become writable, and an **OK** button appear. Make a change and click **OK**. If you see a "Saving..." message in the field, and nothing else is happening, check the end of your `log/development.log file`. If you're curious about the calls to `protect_from_forgery`, they're related to a security issue that was addressed in Rails 2.0, but not by the plugin.

<a name="adding_borrower_data" id="adding_borrower_data"></a>
## Adding Borrower Data

Now that we have a working library of DVDs, let's add the pieces needed to track DVDs that leave the library, who took them, and when they need to bring them back.

Run **Rails Tools** > **Generators** > **Migration**, with a migration name of `AddBorrowerInformation`.

Set the contents of `add_borrower_information.rb` to this:

```
class AddBorrowerInformation < ActiveRecord::Migration
    def self.up
      add_column :movies, :borrower, :string, :limit => 60
      add_column :movies, :borrowed_on, :date
      add_column :movies, :due_on, :date
    end

    def self.down
      remove_column :movies, :borrower
      remove_column :movies, :borrowed_on
      remove_column :movies, :due_on
    end
  end

```

Run the **Rails Tools** > **Migrate** > **db:migrate** tool.

Let's add another validation routine. This one's more complex: we want to verify that if any of the `borrower`, `borrowed_on`, and `due_on` fields are specified, they all are, and we'll do a sanity check on the value of `due_on`. This is to guard the case where someone hits the controller without going through one of our own views.

Add this method to `movie.rb`:

```
def validate
    if borrowed_on.blank? && borrower.blank? && due_on.blank?
      # ok
    elsif !borrowed_on.blank? && !borrower.blank? && !due_on.blank?
      if due_on <borrowed_on
        errors.add(:due_on, "is before date-borrowed")
      end
    elsif borrowed_on.blank?
      errors.add(:borrowed_on ,"is not specified")
    elsif borrower.blank?
      errors.add(:borrower ,"is not specified")
    else
      errors.add(:due_on ,"is not specified")
    end
  end

```

Add this test to `movie_test.rb`:

```
def test_borrower
    m = Movie.create(:title => "House")
    m.borrowed_on = Date.today
    assert !m.valid?
    m.borrower = "Dave"
    assert !m.valid?
    m.due_on = Date.yesterday # Date.today - 1 if using Rails 3.0
    assert !m.valid?
    m.due_on = m.borrowed_on + 3
    assert m.valid?

    # Now clear the borrower
    m.borrower = ""
    assert !m.valid?
  end

```

The unit and functional tests should all pass.

<a name="handling_checkouts" id="handling_checkouts"></a>
## Handling Checkouts

We're almost done. Let's outline the remaining pieces, since we're now moving away from the code Rails generated for us:

1.  Add a `checkout` method and `checkout` screen
1.  Add a `return` method
1.  Show the details in the list view

Here's the RHTML for the checkout screen. Create the file `app/views/movies/checkout.erb` with this code. One way to create this file is to right-click the `app/views/movies` folder and select **Add New File**

```
<h1>Checkout a movie</h1>
    <p>Title: <%= h @movie.title %></p>
    <% form_tag :action => 'checkout', :id => @movie do %>
      <p>Your name: <%= text_field(:movie, :borrower) %>
      <%= submit_tag 'Check out' %>
    <% end %>
    <%= link_to 'Back to the library', movies_path %>

```

You might have noticed that we accept any name to be typed in the form. We can get away with this because we're building a lending library that our friends will use. In a public application you would need to build a separate table to track members, and another one to handle login status, and then you'd have to deal with issues like password hashing and email address verification. All good information, and interesting, but beyond the scope of this tutorial. See the references section for more info.

Here are the two new methods we need to add to the `movies_controller.rb`:

```
# Non-Rest methods
   def checkout
     @movie = Movie.find(params[:id])
     if request.post?
       # It's an update
       @movie.borrower = params[:movie][borrower]
       @movie.borrowed_on = today = Date.today
       @movie.due_on = today + 7
       if @movie.save
         flash[:notice] = 'Movie was successfully created.'
         redirect_to(movies_url)
       else
         render :action => "checkout"
       end
     else
       # Render the template, the default
     end
   end

   def return
     @movie = Movie.find(params[:id])
     @movie.borrower = @movie.borrowed_on = @movie.due_on = nil
     @movie.save!
     redirect_to(movies_url)
   end

```

I assume HTML output to simplify the code. If you want you can add the `respond_to` and `format` statements. Note how we overload the `checkout` method -- if it's part of a `get` request, we render the form. Otherwise we assume we're processing the submitted form.

Finally we update the list view in `index.erb`:

```
<h2>Movies</h2>

  <table>
    <tr>
      <th class="dvdlib_header">Title</th>
      <th class="dvdlib_header">Status</th>
    </tr>
   <% for movie in @movies %>
    <tr>
      <td class="dvdlib_item">
       <% @movie = movie %>
       <%= in_place_editor_field :movie, :title %>
     </td>
      <% if movie.borrower %>
      <td class="dvdlib_item">Signed out by: <%= h movie.borrower %></td>
      <td class="dvdlib_item">Due <%= h movie.due_on %></td>
      <td class="dvdlib_item"><%= link_to 'Return', :action => 'return', :id => movie %></td>
      <% else %>
      <td class="dvdlib_item"><%= link_to 'Check out', :action => 'checkout', :id => movie %></td>
      <td class="dvdlib_item"><%= link_to 'Remove', { :action => 'destroy', :id => movie },
         :confirm => 'Are you sure?', :method => :delete %></td>
      <% end %>
    </tr>
   <% end %>
  </table>
  <% if @movies.size > 0 -%>
  <br />
  <%= will_paginate(@movies) %>
  <% end %>
  <br />
  <%= link_to 'Add new movie', new_movie_path %>

```

Add two tests to `movies_controller_test.rb` to verify that everything is working correctly:

```
def test_checkout_get
    get :checkout, :id => movies(:one).id
    assert_response :success
  end

  def test_checkout_put
    post :checkout, :id => movies(:one).id, :movie => {:borrower => "Fred"}
    assert_redirected_to movies_path
  end

```

We were expecting no errors, but this time we get an `undefined local variable or method error` for `borrower` at around line 97-99 of `movie_controller.rb`. Sure enough, we forgot to put a ":" before the param name "borrower". Change it to `:borrower`, rerun the tests, and they should pass.

People familiar with the first version of this tutorial will recall using the debugger to correct a problem like this. Writing tests is more efficient. You can debug Rails apps if you need to, though. Press the `Rails Tools** > **Run** > **debug rails app` tool, set breakpoints at the points in the controllers and views you're interested in, and then hit them with your application.

Finally, start the server one more time, and verify that your application now works as you expect. You're ready to take this one live.
