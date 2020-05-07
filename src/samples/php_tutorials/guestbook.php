<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html lang="en">
    <head>
        <title>PHP Guestbook</title>
    </head>
    <body>
    <h2 align="center">PHP Guestbook</h2>
    <hr>
<?php 
//****************************************************************** 
// 
//  Simple Guestbook
//        by Shane Caraveo (shanec@ActiveState.com) 
//
//******************************************************************

// change this to a location apropriate for your system, the file does not need to exist
// but you must have write access to the directory.
$tmpDir = getenv('TEMP');
if (!$tmpDir)
    $tmpDir = "/tmp";
$dataFile = $tmpDir."/guestbook.dat";


class GuestBook {
    // class variable definitions
    var $gb_dat;
    var $data;
    
    /*
       GuestBook constructor
       initializes guestbook data
     */
    function GuestBook($dataFile) {
        $this->gb_dat = $dataFile;
        $this->data = "";
        $this->_getData();
        
        // if data was posted to the script, lets add an entry to the guestbook
        if ($_SERVER["REQUEST_METHOD"]=="POST") {
            if (!$this->addGuestBookEntry()) {
                echo("Error in posting to the guestbook, please use <a href=\"".$_SERVER["PHP_SELF"]."\">".$_SERVER["PHP_SELF"]."</a> to post your entry.<br><br><hr>\n");
            }
        }        
        if ($this->data) $this->outputData();
        $this->outputForm();
    }

    /*
        _getData
        reads the data from the guestbook data file
     */
    function _getData() {
        $lines = @file($this->gb_dat);
        if ($lines) {
            $this->data = join($lines, "\n");
        }
    }
    
    /*
       outputData
       writes the contents of the guestbook data file to stdout
    */
    function outputData() {
        echo $this->data;
    }

    /*
       _createEntryHTML
       use data from the post to create an HTML sniplet
    */
    function _createEntryHTML() {
        // get the posted data
        $name = $_POST["name"];
        $email = $_POST["email"];
        $company = $_POST["company"];
        $message = $_POST["message"];
        
        // just a little validation, in the real world, real validation should be done
        if (!$name || !$message) {
            echo ("You did not enter your name or message, please resubmit your entry.<br><br><hr>\n");
            return NULL;
        }
        
        // get the current time
        $today = date("F j, Y, g:i a");
        
        // build the html for the posted entry
        $data = "Posted: <b>$today</b> by <b>$name</b> &lt;$email&gt;<br>".
            "Company: $company<br>\n".
            "<p>$message</p><br><hr>\n";
        
        return $data;
    }
    
    /*
       _writeDataFile
       write the data back to the datafile
     */
    function _writeDataFile() {
        // open and clear the file of it's contents
        $f = @fopen($this->gb_dat, "w");
        if (!$f) {
            echo ("Error opening $this->gb_dat.<br>\n");
            return false;
        }
        // write the new file    
        if (fwrite($f, $this->data) < 0) {
            echo ("Error writing data to $this->gb_dat.<br>\n");
        }
        fclose($f);
        return true;
    }
    
    /*
       addGuestBookEntry
       this function formats the post data into html, and adds it
       to the data file
     */
    function addGuestBookEntry() {
        $entry = $this->_createEntryHTML();
        if (!$entry) return false;
        $this->data = $entry.$this->data;
        return $this->_writeDataFile();
    }

    function outputForm() {
        // below is our entry form for adding a guestbook entry
        // we insert the link to this page so the form will work, no matter
        // where we put it, or what we call it.
        ?>
        <a name="post"><b>Please sign our Guest Book</b></a><br> 
        <form action="<?php echo($_SERVER["PHP_SELF"]);?>" method="POST"> 
        Name: <input type="Text" name="name" size="40" maxlength="50"><br> 
        Email:  <input type="Text" name="email" size="35" maxlength="40"><br> 
        Company: <input type="Text" name="company" size="35" maxlength="40"><br> 
        Message:<br> 
        <textarea name="message" cols="40" rows="8" wrap="PHYSICAL"></textarea><br> 
        <input type="Submit" name="action" value="Submit"> 
        <input type="reset"> 
        </form> 
        <?php
    }
}

// create an instance of the guestbook,
// the guestbook constructor handles everything else.
$gb = new GuestBook($dataFile);
?>
</body>
</html>
