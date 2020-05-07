///// represents a single document
var documentModel = function()
{
    this.locked = false;
};

(function() {
    // Get this document from the servdocumentModeland lock it here
    documentModel.prototype.load = function(key, callback)
    {
        var _this = this;
        $.ajax('/documents/' + key,
        {
            type: 'get',
            dataType: 'json',
            success: function(res)
            {
                this._load(res, key, callback);
            }.bind(this),
            error: function(err)
            {
                callback(null, false);
            }
        });
    };

    documentModel.prototype._load = function(res, key, callback)
    {
        this.locked = true;
        this.key = key;
        this.data = res.data;
        this.language = res.language;
        this.scheme = res.scheme;
        this.keep = res.keep;
        this.font = res.font;
        this["font-size"] = res["font-size"];
        this["line-spacing"] = res["line-spacing"];
        this.wrapping = res.wrapping;
        this.security = res.security;

        callback(
        {
            value: this.data,
            key: key,
            language: this.language,
            scheme: this.scheme,
            keep: this.keep,
            font: this.font,
            "font-size": this["font-size"],
            "line-spacing": this["line-spacing"],
            wrapping: this.wrapping,
            security: this.security
        });
    }

    // Save this document to the server and lock it here
    documentModel.prototype.save = function(data, callback)
    {
        if (this.locked)
        {
            return false;
        }

        $.ajax(
        {
            url: '/documents',
            type: 'POST',
            data: data,
            dataType: 'json',
            contentType: false,
            success: function(res)
            {
                this._load(data, res.key, callback);
            }.bind(this),
            error: function(res)
            {
                try
                {
                    callback(null, $.parseJSON(res.responseText));
                }
                catch (e)
                {
                    callback(null,
                    {
                        message: 'Something went wrong!'
                    });
                }
            }
        });
    };


})();
