///// represents the paste application

var kopy = function()
{

    var self = this;

    var textarea,
        editor,
        options,
        documentTitle,
        prevPath;

    this.init = function()
    {
        textarea = $('textarea');
        editor = null;
        options = {};
        documentTitle = document.title;

        this.configureShortcuts();
        this.configureButtons();
        this.configureOptions();
        this.configurePrefs();

        // Load Font prefs
        var loadCookies = ["font", "font-size", "line-spacing", "wrapping", "security"];
        loadCookies.forEach(function(cookie)
        {
            var value = Cookies.get(cookie);
            if ( ! value) return;

            var select = $("select[name="+cookie+"]");
            setSelected(select, value);
            select[0].updateTitle();

            // Persist cookie
            Cookies.set(cookie, value, {expires: 2592000});
        });

        // Handle popstate
        prevPath = null;
        // Set up the pop state to handle loads, skipping the first load
        // to make chrome behave like others:
        // http://code.google.com/p/chromium/issues/detail?id=63040
        setTimeout(function()
        {
            window.onpopstate = function(evt)
            {
                try { self.handlePop(evt); } catch(err) { /* not loaded yet */ }
            };
        }, 1000);

        this.handlePop({ target: window });

        $(document.body).keydown(function(evt)
        {
            if (evt.keyCode == 27 && $(".modal:visible").length)
            {
                this.closeModal(".modal:visible");
            }
        }.bind(this));
    }

    this.handlePop = function(evt)
    {
        var path = evt.target.location.pathname;
        if (prevPath == path) return;

        prevPath = path;
        if (path === '/')
            this.newDocument(true);
        else
            this.loadDocument(path.substring(1, path.length));
    };

    // Set the page title - include the appName
    this.setTitle = function(ext)
    {
        var title = ext ? documentTitle + ' - ' + ext : documentTitle;
        document.title = title;
    };

    // Show a message box
    this.showMessage = function(msg, cls)
    {
        var msgBox = $('<li class="' + (cls || 'info') + '">' + msg + '</li>');
        $('#messages').hide().prepend(msgBox).slideDown('fast');
        setTimeout(function()
        {
            msgBox.slideUp('fast', function()
            {
                $(this).remove();
            });
        }, 5000);
    };

    this.mode = 'view';

    this.setEditMode = function()
    {
        this.mode = 'edit';
        this.toggleContext(['save', 'info', 'keep', 'language', 'security']);
    };

    this.setViewMode = function()
    {
        this.mode = 'view';
        this.toggleContext(['new', 'duplicate', 'info', 'link']);
    };

    this.loadEditor = function(value, options)
    {
        if (editor)
            editor.toTextArea();

        if (value !== undefined)
            textarea.val(value);

        options = $.extend({
            lineNumbers: true,
            mode: null,
            indentUnit: 4,
            smartIndent: true,
            indentWithTabs: false
        }, options);

        CodeMirror.modeURL = "/components/codemirror/mode/%N/%N.js";
        editor = CodeMirror.fromTextArea(textarea[0], options);
        window.editor = editor;

        var prevLineCount = editor.getDoc().lineCount();
        editor.on("changes", function()
        {
            var lineCount = editor.getDoc().lineCount();
            if (lineCount != prevLineCount)
            {
                prevLineCount = lineCount;
                this.updateEditorMode();
                this.updateFontSize();
            }
        }.bind(this));

        editor.focus();

        if (options.readOnly)
            $(".CodeMirror").addClass("readonly");

        this.editor = editor;

        if (options.language)
            this.selectLanguage(options.language);

        var onResize = function()
        {
            $(".CodeMirror, .CodeMirror-scroll").css("height", $(window).height());
            editor.refresh();
        };

        onResize();

        if ( ! this.loadEditor.listener)
        {
            this.loadEditor.listener = true;
            $(window).resize(debounce(onResize));
        }

        $(".CodeMirror-code").on("click", function(e)
        {
            if ( ! e.target.classList.contains("CodeMirror-linenumber")) return
            this.setHash({line: e.target.textContent});
            this.highlightLine(e.target.textContent);
        }.bind(this));
    }

    this.updateEditorMode = function()
    {
        var language = $("select[name=language]").val();

        var mode = language;
        if (language in languages.map.byTitle)
            mode = languages.map.byTitle[language];

        if (mode == "-1")
            mode = languages.detect(editor.getDoc().getValue()) || "null";
            
        CodeMirror.autoLoadMode(editor, mode.file || mode);
        
        var modeName = mode;
        if (modeName == "php") // quick and dirty - this needs to be refactored
        {
            var input = editor.getDoc().getValue().toLowerCase();
            modeName = input.indexOf("<?php") == -1 ? "text/x-php" : "php";
        }
        editor.setOption("mode", modeName);
    }

    // Set the key up for certain things to be enabled
    this.toggleContext = function(enable)
    {
        var $this, i = 0;
        $('.context-toggle').removeClass("enabled");
        for (i = 0; i < enable.length; i++)
        {
            $('.context-toggle.' + enable[i]).addClass("enabled");
        }
    };

    // Remove the current document (if there is one)
    // and set up for a new one
    this.newDocument = function(hideHistory, opts)
    {
        this.doc = new documentModel();
        if (!hideHistory)
        {
            window.history.pushState(null, this.appName, '/');
        }

        this.loadEditor("", opts);

        this.setTitle();
        this.setEditMode();

        this.onDocumentReady();
    };

    // Load a document and show it
    this.loadDocument = function(key)
    {
        // Split the key up
        var language = null;
        if (key.indexOf(".")!==-1)
        {
            var _key = key.split(".");
            var ext = _key[1];
            key = _key[0];

            language = ext;
            if (ext in languages.map.byExt)
                language = languages.map.byExt[ext];
        }

        // Ask for what we want
        this.doc = new documentModel();
        this.doc.load(key, function(ret, err)
        {
            if ( ! ret)
                this.newDocument();

            if ( ! language)
                language = ret.language || '-1';

            var encryptkey;
            if (ret.security == "encrypted")
            {
                encryptkey = this.getHash('key');

                if ( ! encryptkey)
                {
                    this.openModal("#encryptkey");

                    $("#encryptkey form").one("submit", function(e)
                    {
                        var encryptkey = $("#encryptkey input").val();
                        this.setHash({key: encryptkey});
                        this.loadDocument(key);
                        this.closeModal("#encryptkey");
                    }.bind(this));
                    return;
                }

                ret.value = CryptoJS.AES.decrypt(ret.value, encryptkey).toString(CryptoJS.enc.Utf8);
            }

            this.loadEditor(ret.value, {readOnly: true, language: language});
            this.setTitle(ret.key);
            this.setViewMode();

            var select;
            var opts = ["scheme", "keep", "font", "font-size", "line-spacing", "wrapping"];
            for (var k in opts)
            {
                k = opts[k];
                if ( ! k in ret || ret[k] === undefined) continue;

                if (k == "scheme")
                {
                    if (Cookies.get('scheme'))
                        continue;

                    this.selectScheme(ret[k]);
                    continue;
                }

                if ( ! Cookies.get(k))
                {
                    select = $("select[name="+k+"]")
                    setSelected(select, ret[k]);

                    if ("updateTitle" in select[0])
                        select[0].updateTitle();
                }
            }

            this.onDocumentReady();

        }.bind(this));
    };

    this.onDocumentReady = function()
    {
        this.updateFonts();
        this.updateWrapping();
        this.updateScheme();
        this.updateEditorMode();

        var line = this.getHash("line");
        if (line)
        {
            this.highlightLine(line);
        }

        prevPath = location.pathname;
    }

    // Duplicate the current document - only if locked
    this.duplicateDocument = function()
    {
        if ( ! this.doc.locked) return;

        var currentData = editor.getValue();
        this.newDocument(false);

        editor.getDoc().setValue(currentData);
    };

    // Lock the current document
    this.saveDocument = function()
    {
        var data = {data: editor.getDoc().getValue()};
        $("select").each(function()
        {
            data[$(this).attr("name")] = $(this).val();
        });

        var encryptKey = null;
        if (data.security == "encrypted")
        {
            encryptKey = createKey(14);
            data.data = CryptoJS.AES.encrypt(data.data, encryptKey).toString();
        }

        this.doc.save(data, function(ret, err)
        {
            if (err)
            {
                this.showMessage(err.message, 'error');
            }
            else if (ret)
            {
                this.setTitle(ret.key);
                var path = '/' + ret.key;
                if (encryptKey)
                    path += "#" + encryptKey;

                window.history.pushState(null, this.appName + '-' + ret.key, path);
                this.setViewMode();
                this.loadEditor(editor.getDoc().getValue(), {readOnly: true});

                this.onDocumentReady();
            }
        }.bind(this));
    };

    this.configureButtons = function()
    {
        var isOSX = window.navigator.platform.toLowerCase().indexOf("mac") === 0
        var ctrl = isOSX ? "CMD" : "CTRL";

        this.buttons = [
        {
            $where: $('#buttons .save'),
            label: 'Save',
            shortcutDescription: ctrl + ' + S',
            shortcut: function(evt)
            {
                return (isOSX ? evt.metaKey : evt.ctrlKey) && (evt.keyCode === 83);
            },
            action: function()
            {
                if (editor.getDoc().getValue().replace(/^\s+|\s+$/g, '') !== '')
                {
                    this.saveDocument();
                }
            }.bind(this)
        },
        {
            $where: $('#buttons .new'),
            label: 'New',
            shortcut: function(evt)
            {
                return this.doc.locked && ! evt.ctrlKey && ! evt.metaKey && evt.keyCode === 78
            }.bind(this),
            shortcutDescription:'N',
            action: function()
            {
                this.newDocument(!this.doc.key);
            }.bind(this)
        },
        {
            $where: $('#buttons .duplicate'),
            label: 'Duplicate & Edit',
            shortcut: function(evt)
            {
                return this.doc.locked && (isOSX ? evt.metaKey : evt.ctrlKey) && evt.keyCode === 68;
            }.bind(this),
            shortcutDescription: ctrl + ' + D',
            action: this.duplicateDocument.bind(this)
        },
        {
            $where: $('#buttons .link'),
            label: 'Copy Link',
            shortcut: function(evt)
            {
                if (editor.getSelection() != '' ||
                    window.getSelection().toString() != '' ||
                    $(".modal").is(":visible"))
                {
                    return false;
                }

                return this.doc.locked && (isOSX ? evt.metaKey : evt.ctrlKey) && evt.keyCode === 67;
            }.bind(this),
            shortcutDescription: ctrl + ' + C',
            action: function()
            {
                $("#copy input").val(location.toString());
                this.openModal("#copy", function() { $("#copy input").select() });
            }.bind(this)
        },
        {
            $where: $('#buttons .info'),
            label: 'Information about kopy.io',
            action: function()
            {
                var aboutModal = $("#about");
                if ( ! aboutModal.data("ready"))
                {
                    $.get("/documents/about", function(result)
                    {
                        var html = marked(result.data);
                        aboutModal.children(".inner").html(html);
                    });
                }
                
                this.openModal("#about");
            }.bind(this)
        }];

        for (var i = 0; i < this.buttons.length; i++)
        {
            this.configureButton(this.buttons[i]);
        }
    };

    this.configureButton = function(opts)
    {
        // Handle the click action
        opts.$where.click(function(evt)
        {
            evt.preventDefault();
            if (!opts.clickDisabled && $(this).hasClass('enabled'))
            {
                opts.action();
            }
        });

        var mouseenter = false;
        var timer;
        // Show the label
        opts.$where.mouseenter(function(evt)
        {
            self.configureButton.mouseenter = true;
            $('#buttonTips .label').text(opts.label);
            $('#buttonTips').fadeIn({duration: 100, queue: false});
            $(this).append($('#pointer'));
            $('#pointer').fadeIn({duration: 100, queue: false});

            if ("shortcutDescription" in opts)
            {
                $('#buttonTips .shortcut').text("Shortcut: " + opts.shortcutDescription);
            }
        });
        // Hide the label
        opts.$where.mouseleave(function(evt)
        {
            self.configureButton.mouseenter = false;
            clearTimeout(self.configureButton.timer);

            self.configureButton.timer = setTimeout(function() {
                if (self.configureButton.mouseenter) return;

                $('#buttonTips').fadeOut({duration: 50, queue: false});
                $('#pointer').fadeOut({duration: 50, queue: false});
            }, 100)
        });
    };

    // Configure keyboard shortcuts for the textarea
    this.configureShortcuts = function()
    {
        $(document.body).keydown(function(evt)
        {
            var button;
            for (var i = 0; i < self.buttons.length; i++)
            {
                button = self.buttons[i];
                if (button.shortcut && button.shortcut(evt))
                {
                    evt.preventDefault();
                    button.action(evt);
                    return;
                }
            }
        });
    };

    this.configureOptions = function()
    {
        var self = this;

        var dropdowns = [
        {
            $where: $('form[name=options] select[name=keep]'),
            onChange: function(selected)
            {

            }
        },
        {
            $where: $('form[name=options] select[name=language]'),
            onChange: function(selected)
            {
                self.updateEditorMode();
            }
        },
        {
            $where: $('form[name=options] select[name=security]'),
            onChange: function(selected)
            {
                Cookies.set('security', $(this).val(), {expires: 2592000});
            }
        },
        {
            $where: $('select[name=scheme]'),
            onChange: function()
            {
                Cookies.set('scheme', $(this).val(), {expires: 2592000});
                self.updateScheme();
            },
            onLoad: function(select)
            {
                var timer = null;
                var hovering = false;
                select.on("mouseenter", "option", debounce(function(e,o)
                {
                    hovering = true;
                    self.updateScheme($(this).text());
                }));

                select.on("focusout", debounce(function(e,o)
                {
                    if ( ! hovering) return;
                    hovering = false;
                    self.updateScheme();
                }, 150));

                $(document).on("click", debounce(function(e,o)
                {
                    if ( ! $(e.target).parents(select).length) return;
                    if ( ! hovering) return;
                    hovering = false;
                    self.updateScheme();
                }, 150));
            }
        },
        {
            $where: $('select[name=font]'),
            onChange: function(selected)
            {
                Cookies.set('font', $(this).val(), {expires: 2592000});
                self.updateFont();
            }
        },
        {
            $where: $('select[name=font-size]'),
            onChange: function(selected)
            {
                Cookies.set('font-size', $(this).val(), {expires: 2592000});
                self.updateFontSize();
            }
        },
        {
            $where: $('select[name=line-spacing]'),
            onChange: function(selected)
            {
                Cookies.set('line-spacing', $(this).val(), {expires: 2592000});
                self.updateLineSpacing();
            }
        },
        {
            $where: $('select[name=wrapping]'),
            onChange: function(selected)
            {
                Cookies.set('wrapping', $(this).val(), {expires: 2592000});
                self.updateWrapping();
            }
        }
        ];

        var updateTitle = function(select)
        {
            var select = $(select);
            var selected = select.find('option:selected');
            var prefix = "<strong>" + select.data("prefix") + "</strong>";
            select.parent().children(".title").html(prefix + selected.text());
        }

        dropdowns.forEach(function(dropdown)
        {
            var select = $(dropdown.$where);

            var wrap = $('<div class="option dropdown">');
            wrap.append("<span class=title>");
            select.wrap = wrap;

            select.after(wrap)
            wrap.append(select);

            select.bind("change", function()
            {
                dropdown.onChange.apply(this, arguments);
                updateTitle(this);
            });

            if (dropdown.onLoad)
                dropdown.onLoad(select);

            updateTitle(select);

            select[0].updateTitle = updateTitle.bind(this, select);
        });
    };

    this.configurePrefs = function()
    {
        $("#pref-link").click(function()
        {
            this.openModal("#preferences");
        }.bind(this));
    }

    this.openModal = function(elem, callback)
    {
        if ($(".modal:visible").length)
            this.closeModal(".modal:visible");

        elem = $(elem);
        if ( ! ("_modal" in elem[0]))
        {
            elem[0]._modal = true;
            var closeBtn = elem.find(".close");
            if (closeBtn.length)
            {
                closeBtn.bind("click", this.closeModal.bind(this, elem));
            }
        }

        elem.css({opacity: 0, top: "20%"})
                .show()
                .animate({top: "50%", opacity: 1}, 'fast', callback);

        elem.find("input:first").focus();
        
        elem.addClass("open");
    }

    this.closeModal = function(elem)
    {
        elem = $(elem);
        elem.css({opacity: 1, top: "50%"})
                .show()
                .animate({top: "80%", opacity: 0}, 'fast', function()
                         { elem.hide(); elem.removeClass("open"); });
    }

    this.updateFonts = function()
    {
        this.updateFont();
        this.updateFontSize();
        this.updateLineSpacing();
    }

    this.updateFont = function()
    {
        var font = $("select[name=font]").val();
        var fontFile = font.replace(/\s+/g,"") + ".css";
        $("#font").attr("href", "css/fonts/" + fontFile);
        if (editor) editor.refresh();
    }

    this.updateFontSize = function()
    {
        var CM = $(".CodeMirror");
        var size = $("select[name=font-size]").val();
        CM.removeClass("fsize-xs fsize-s fsize-m fsize-l fsize-xl");

        if (size == "auto" && editor)
        {
            size = 'xl';
            var sizeMap = {'xl': 'l', 'l': 'm', 'm': 's', 's': 'xs'};
            var overflown = true;
            var elem    = $('.CodeMirror-scroll')[0],
                width   = elem.offsetWidth,
                height  = elem.offsetHeight;
            while (overflown && size != 'xs')
            {
                CM.addClass("fsize-" + size);
                editor.refresh();
                if (elem.scrollHeight <= height && elem.scrollWidth <= width)
                    overflown = false;
                else
                {
                    CM.removeClass("fsize-" + size);
                    size = sizeMap[size];
                }
            }
        }

        CM.addClass("fsize-" + size);
        if (editor) editor.refresh();
    }

    this.updateLineSpacing = function()
    {
        var size = $("select[name=line-spacing]").val();
        $(".CodeMirror").removeClass("lspace-l lspace-xl lspace-s lspace-m");

        if (size != "-1")
        {
            $(".CodeMirror").addClass("lspace-" + size);
        }
        if (editor) editor.refresh();
    }

    this.updateScheme = function(forceScheme)
    {
        if (this.updateScheme.firstLoad === undefined)
        {
             this.updateScheme.firstLoad = false;
             var schemeName = Cookies.get('scheme');

             if (schemeName)
                this.selectScheme(schemeName);
        }

        var scheme;
        if (forceScheme)
        {
            scheme = forceScheme;

            var elem = $('select[name=scheme] option:contains("'+scheme+'")').filter(function ()
            {
               return $(this).text() == scheme;
            });
            scheme = elem.val();
        }
        else
            scheme = $("select[name=scheme]").val();

        if ( ! scheme || scheme == "-1") scheme = "base16-default.dark";

        $("#scheme").attr("href", "css/schemes/"+scheme+".css");

        if (this.updateScheme.active)
            $(".CodeMirror").removeClass(this.updateScheme.active);

        this.updateScheme.active = "cm-s-" + scheme.replace(".", "-");
        $(".CodeMirror").addClass(this.updateScheme.active);
    }

    this.updateWrapping = function()
    {
        var wrapping = $("select[name=wrapping]").val();
        editor.setOption("lineWrapping", wrapping == "Enabled");
        if (editor) editor.refresh();
    }

    this.selectScheme = function(scheme)
    {
        var select = $('select[name=scheme]');
        setSelected(select, scheme);

        select[0].updateTitle();
    }

    this.selectLanguage = function(language)
    {
        var select = $('select[name=language]');
        select.find('option:selected').removeAttr("selected");

        var elem = select.find('option:contains("'+language+'")').filter(function ()
        {
           return $(this).text() == language;
        });

        if (elem.length)
            elem.attr("selected", true);
        else
            select.find("option[value="+language+"]:first").attr("selected", true);

        select[0].updateTitle();
    }

    this.highlightLine = function(line)
    {
        var t = editor.charCoords({line: line, ch: 0}, "local").top;
        var middleHeight = editor.getScrollerElement().offsetHeight / 2;
        editor.scrollTo(null, t - middleHeight - 5);

        if ("_activeLine" in this.highlightLine)
        {
            var _line = this.highlightLine._activeLine;
            editor.removeLineClass(_line-1, "wrap", "CodeMirror-activeline");
            editor.removeLineClass(_line-1, "background", "CodeMirror-activeline-background");
            delete this.highlightLine._activeLine;

            if (_line == line)
            {
                this.setHash({line: ""});
                editor.refresh();
                return;
            }
        }

        $(".CodeMirror-activeline").removeClass("CodeMirror-activeline");
        $(".CodeMirror-activeline-background").removeClass("CodeMirror-activeline-background");

        editor.addLineClass(line-1, "wrap", "CodeMirror-activeline");
        editor.addLineClass(line-1, 'background', 'CodeMirror-activeline-background');
        this.highlightLine._activeLine = line;
        editor.refresh();
    }

    this.setHash = function(opts)
    {
        var hash = this.getHash();
        hash = $.extend(hash, opts);
        var _hash = [];
        for (var h in hash)
        {
            if (hash[h] == "") continue;

            if (h == "key")
                _hash.push(hash[h]);
            else
                _hash.push(h+"-"+hash[h]);
        }
        location.hash = _hash.join("&");
    }

    this.getHash = function(opt)
    {
        if ( ! location.hash.length) return opt ? false : {};

        var hash = location.hash.substr(1);
        var _hash = hash.split("&");
        hash = {};
        for (var h in _hash)
        {
            h = _hash[h];
            if (h.indexOf("-") != -1)
            {
                var _h = h.split("-");
                hash[_h[0]] = _h[1];
            }
            else
            {
                hash.key = h;
            }
        }

        if (opt)
        {
            return hash[opt];
        }

        return hash;
    }

    $(document).ready(this.init.bind(this));

};

$(function()
{
    window.app = new kopy();
});
