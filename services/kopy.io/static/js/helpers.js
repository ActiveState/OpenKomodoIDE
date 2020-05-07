function debounce(func, wait, immediate) {
    wait = wait || 100;
    immediate = immediate || false;

	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

function setSelected(select, value)
{
    select.children(':selected').removeAttr("selected");
    select.children().filter(function ()
    {
        var el = $(this);
        var val = el.attr("value") || el.text();
        return val == value;
    }).attr("selected", true);
    select.val(value);

}

function createKey(keyLength)
{
    var keyspace = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var text = '';
    var index;
    for (var i = 0; i < keyLength; i++)
    {
        index = Math.floor(Math.random() * keyspace.length);
        text += keyspace.charAt(index);
    }
    return text;
};

