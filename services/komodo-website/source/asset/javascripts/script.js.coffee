#= require "underscore/underscore"
#= require "jquery/jquery"
#= require "jquery-ui/ui/jquery-ui"
#= require "jReject/js/jquery.reject"
#= require "jquery-cookie/jquery.cookie"
#= require "textFit/textFit"
#= require "consolelog/consolelog"
#= require "modernizr/modernizr"
#= require "highlightjs/highlight.pack"
#= require "tooltipster/js/jquery.tooltipster"
#= require "magnific-popup/dist/jquery.magnific-popup"
#= require "github.commits.widget/js/github.commits.widget"
#= require "jquery-slideshow-lite/js/jquery.slideshow.lite"
#= require "handlebars/handlebars"
#= require "moment/moment"
#= require "jquery-visible/jquery.visible"
#= require "selectize/dist/js/standalone/selectize"
#= require "stickyfloat/stickyfloat.js"

#= require "helpers/localStorage"
#= require "helpers/handlebars"
#= require "helpers/easing"

jQuery ->

    jq = jQuery
    main = jq "section[role=main]"

    init = () ->
        fns = [
            rejectOldBrowsers
            highlightCode
            bindAnalytics
            bindTooltips
            bindLightbox
            loadTabs
            loadNavmenu
            loadSidebarCollapser
            loadDialogs
            forceOpenExternal
            disableLinks
            bindCheckboxEnablers
            bindPaneSelector
            loadFancySelector
            loadStickyFloat
            loadSchemePreviews
            loadPackageSearch
        ]
        for fn in fns
            setTimeout fn, 0

    # ----- Misc Scripts -----

    # Reject Older Browsers
    rejectOldBrowsers = ->
        reject = ["msie5", "msie6", "msie7", "msie8", "firefox1", "firefox2",
                  "firefox3", "konqueror", "safari2", "safari3"]
        reject = _.reduce reject, (o, v) ->
            o[v] = true
            return o
        , {}

        jq.reject
            reject: reject
            display: _.shuffle ['chrome', 'firefox', 'safari', 'msie']
            imagePath: "/images/browsers/"
            browserInfo: # Fix Naming Inconsistencies
                msie:
                    text: 'Internet Explorer'
                safari:
                    text: 'Safari'

    # Highlight Code
    highlightCode = ->
        jq('pre code').each (i, e) ->  hljs.highlightBlock e
    
    # Analytics
    bindAnalytics = ->
        if ga? || clicky?
            jq("a[data-analytics]").click ->
                elem = jq this
                [category, action, label] = elem.data("analytics").split(":")
                ga("send", "event", category, action, label) if ga?
                
                clicky.log(window.location.href, [category, action, label].join(":"),
                           (if category is "download" then "download" else "outbound")) if clicky?

    # Tooltips
    bindTooltips = ->
        jq('.tooltip').each ->
            elem = jq(this)
            elem.tooltipster
                contentAsHTML: true
                position: elem.data("tooltip-position") || 'right'
                theme: "tooltipster-default " + (elem.data("tooltip-class") || '')
                maxWidth: 250
                functionReady: (origin, tooltip) ->
                    arrow = tooltip.find(".tooltipster-arrow")
                    if arrow.hasClass "tooltipster-arrow-right"
                        arrow.find("span").css "left", "-8px"
                    if arrow.hasClass "tooltipster-arrow-left"
                        arrow.find("span").css "right", "-8px"

    # Lightbox
    bindLightbox = ->
        jq('a.lightbox').magnificPopup
            type:'image'
            removalDelay: 500

        jq('div.lightbox').magnificPopup
            delegate: 'a'
            type:'image'
            removalDelay: 500
            gallery:
               enabled: true
               navigateByImgClick: true
               preload: [0,1]

        jq('div.lightbox-group').each ->
            gallery = jq(this)
            gallery.magnificPopup
                delegate: 'a.lightbox-entry'
                type:'image'
                removalDelay: 500
                gallery:
                   enabled: true
                   navigateByImgClick: true
                   preload: [0,1]
                image:
                    titleSrc: (item) ->
                        if gallery.data("title")
                            return item.el.attr('title') + '<small>' + gallery.data("title") + '</small>'
                        else
                            return item.el.attr('title')

        jq('.slideshow').each ->
            elem = jq this
            elem.slideshow
                caption: elem.data("caption") == "true"
                width: elem.data("width")
                height: elem.data("height")
                pauseSeconds: elem.data("pause") || 6
    # Tabs
    loadTabs = ->
        jq(".tabs").tabs()

    # Nav Collapse
    loadNavmenu = ->
        jq("header .collapser").click -> jq("header nav").toggleClass "expanded"

    # Sidebar collapser
    loadSidebarCollapser = ->
        sideCollapse = jq("#side-collapse")
        sideInner = jq("aside .inner")
        sideCollapse.click ->
            sideCollapse.fadeOut("fast", ->
                sideInner.toggle("slide", {direction: 'right'}, ->
                    sideCollapse.fadeIn "fast"
                    sideInner.css("display", "")
                )
                jq("aside").toggleClass("expand")
            )

    # JS Dialogs
    loadDialogs = ->
        jq.ui.dialog.prototype._focusTabbable = -> {}

        jq("a[data-modal]").click (e) ->
            link = jq(this)
            elem = jq(link.data("modal-elem") || link.attr("href"))

            if ! elem.length
                return

            openModal(elem)
            e.preventDefault()
            return false

        if window.location.hash
            try
                elem = jq(window.location.hash)
                openModal(elem) unless elem.data("modal") == undefined
            catch e
                # Suppress

        # Open Modal Dialog
        openModal = (elem) ->
            if openModal._modal
                openModal._modal.dialog "close"

            elem.dialog(
                modal: true
                draggable: false
                closeOnEscape: true
                minWidth: jq(window).width() / 3
                maxHeight: jq(window).height() / 1.25
                show:
                    effect: "fade"
                    duration:500
                    easing:"easeOutExpo"
                hide:
                    effect: "drop"
                    direction: "down"
                    distance:100
                    duration:500
                    easing:"easeOutExpo"
                open: ->
                    elem.find("[data-enable-after]").each ->
                        el = jq this
                        el.attr "disabled", true
                        setTimeout(
                            -> el.removeAttr "disabled",
                            parseInt(el.data("enable-after")) * 1000
                        )

                    jq('.ui-widget-overlay').click ->
                        elem.dialog "close"
                close: ->
                    delete openModal._modal
            )

            openModal._modal = elem

    # Open external links in a new window
    forceOpenExternal = ->
        href = new RegExp('^' + window.location.protocol + '\\/\\/(?:[a-z]*?\.|)' + window.location.hostname)
        jq("a[href^='http']").filter( ->
            return ! jq(this).attr("href").match(href)
        ).attr("target", "_blank")

    disableLinks = ->
        jq("a.disabled").click ->
            elem = jq this
            return false if elem.hasClass "disabled"

    bindCheckboxEnablers = ->
        jq("input[type=checkbox][data-enables]").click ->
            elem = jq this

            if this.checked
                jq("#" + elem.data("enables")).removeClass("disabled")
            else
                jq("#" + elem.data("enables")).addClass("disabled")

    # Allow pane selection through select fields
    bindPaneSelector = ->
        jq("select.paneSelector").each ->
            elem = jq this
            prefix = elem.data("pane-prefix") || ""
            elem.change ->
                id = "#" + prefix + elem.val()
                jq(id).siblings().hide()
                jq(id).fadeIn("fast")
                window.location.hash = id

            hash = window.location.hash.substr(1).split("|")
            el = jq("#" + hash[0])

            if hash[0] and el.length and hash[0].indexOf(prefix) is 0
                el.siblings().hide()
                el.fadeIn("fast")
                window.location.hash = "#" + hash[1] if (hash[1])
                window.location.hash = "#" + hash.join("|")

                el = jq("[data-pane-prefix=\"#{prefix}\"]")
                if el.length and el[0].selectize
                    el[0].selectize.setValue(hash[0].substr(prefix.length))
                else
                    el.val(hash[0].substr(prefix.length)) if el.length

    # Load fancy selector, allowing for skinnable select fields with more functionality
    loadFancySelector = ->
        jq("select.selectize").each ->
            elem = jq this
            elem.selectize({
                onChange: (value) ->
                    setTimeout (->
                        elem.trigger "change"
                    ), 0
            });
            
    loadStickyFloat = ->
        jq('.sticky').stickyfloat {
            offsetY: 100
            delay: 50
            easing: 'swing'
        }
        
    loadSchemePreviews = ->
        
        qn = jq("#scheme-preview").length
        return unless qn
    
        jq("#scheme-preview > pre").find("[class^=hljs-]").each ->
            el = jq this
            el.attr("class", el.attr("class").replace(/hljs-/g,'hl-'))
        
        jq("#scheme-preview > pre").find("*").contents().filter(-> this.nodeType == 3).each ->
            html = this.nodeValue
            html = html.replace(/([{}*:;.=,\(\)+])/g,':::$1:::')
            html = html.replace(/(self)/g,':;:$1:;:')
            this.nodeValue = html
        
        jq("#scheme-preview > pre > code").each ->
            el = jq this
            html = el.html()
            html = html.replace(/:::([{}*:;.=,\(\)+]):::/g,'<span class="ko-operator">$1</span>')
            html = html.replace(/:;:(self):;:/g,'<span class="ko-keyword">$1</span>')
            el.html(html);
            
    packageCache = null
    loadPackageSearch = ->
        input = jq("#package-search")
        return unless input.length
    
        jq.getJSON "/json/packages/search.json", (data) ->
            packageCache = data
    
        input.on "input", packageSearch.bind(this, false)
        input.on "click", packageSearch.bind(this, false)
        
    packageSearchTimer = null
    packageSearch = (now) ->
        unless now
            packageSearchTimer = setTimeout(packageSearch.bind(this, true), 200)
            return
        
        input = jq("#package-search")
        results = jq("#package-search-results")
        results.empty()
        results.hide()
        
        query = input.val()
        query = jq.trim(query).toLowerCase()
        
        return if query.length < 2
        
        query = query.split(/\s+/g)
        
        count = 0
        for pkg in packageCache
            searchString = (pkg.name + pkg.description).toLowerCase()
            score = 0
            for word in query
                score++ if searchString.indexOf(word) != -1
            
            if score == 0
                continue
            
            result = jq "<li>"
            result.append(jq("<h3>").text(pkg.name))
            result.append(jq("<p>").text(pkg.description))
            result.data("url", pkg.url)
            result.on "click", ->
                el = jq this
                window.location.href = el.data("url")
                
            results.append result
            results.show()
            
            return if ++count == 10

    init()


