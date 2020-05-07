var data = {};
var ko;
var ext_name = '';

var save_button;

function get_id(strId) { return document.getElementById(strId); }
function get_val(strId) {
  var elt = get_id(strId);
  switch(elt.nodeName) {
    case 'textbox':
      return elt.value;
    case 'checkbox':
      return elt.checked ? 1 : 0;
    case 'menulist':
      return elt.selectedItem.label;
  }
  return get_id(strId).value;
}
function set_val(strId, val) {
  var field = get_id(strId);
  if (field) {
    dump("set_val: setting field " + strId + " to "
         + val + "\n");
    field.value = val;
  } else {
    dump("set_val: Can't resolve field " + strId + "\n");
  }
}
function get_nice_name(name) { return trim(name).replace(/[\W]/g,'').toLowerCase(); }
function trim(str) { return str.replace(/^\s*/, '').replace(/\s*$/, ''); }

function setup() {
    data = window.arguments[0];
    ko = window.arguments[1];
    data.valid = false;
    try {
        save_button = document.documentElement.getButton('accept');
    } catch(e) {
        alert('trying to get save button: ' + e);
    }
    try {
        var vars = data.vars;
        for (var p in vars) {
            var item = vars[p];
            var field = get_id(p);
            if (!field) {
                dump("Can't get an item for " + p + "\n");
            }
            switch (field.nodeName) {
              case "textbox":
                field.value = item[0];
                break;
              case 'checkbox':
                field.checked = !!item[0];
                break;
              case 'menulist':
                if (!item[0]) {
                  field.selectedIndex = 0;
                } else {
                  var i, items = field.menupopup.childNodes;
                  for (i = 0; i < items.length; i++) {
                    if (items[i].label == item[0]) {
                      field.selectedIndex = i;
                      break;
                    }
                  }
                  if (i == items.length) {
                    field.selectedIndex = 0;
                  }
                }
                break;
              default:
                dump("Got a field of type " + field.nodeName + "\n");
            }
            if (item[1]) {
                get_id(p + ".label").value += " (*)";
            }
            if (vars[p][1]) {
                field.addEventListener('keyup', checkValid, false);
            }
        }
        checkValid();
    } catch(e) { alert(e); }
}

function cleanup() {
    var vars = data.vars;
    for (var p in vars) {
        if (vars[p][1]) {
            get_id(p).removeEventListener('keyup', checkValid, false);
        }
    }
}

function checkValid() {
    var vars = data.vars;
    for (var p in vars) {
        var item = vars[p];
        if (item[1] && !get_val(p)) {
            return !(save_button.disabled = true);
        }
    }
    return !(save_button.disabled = false);
}

function doSave() {
  try {
    if (checkValid()) {
        data.valid = true;
        data.configured = true;
        var vars = data.vars;
        for (var p in vars) {
            vars[p][0] = get_val(p);
        }
        return true;
    }
  } catch(e) {
    alert(e);
    return false;
  }
}

function cancel() {
  return true;
}

function keys(obj) {
  var out = new Array(); for(i in obj) {
    out.push(i);
  } return out;
}

function browseDirectory() {
  var currDir = get_val('directory') || ko.macros.current.project.getFile().dirname;
  var d = ko.filepicker.getFolder(currDir, "Specify the directory to house the module");
  if (d) {
    set_val('directory', d);
  }
}
