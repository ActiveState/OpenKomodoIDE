stickyfloat
===========

This plugin makes it possible to have a fixed position element that is relative to it’s parent. A normal fixed positioned element would be “out of context” and is very difficult to use in the most common situations with fluid designs. This plugin solves that problem with as little code as I could possible get it so it will run in the most optimized way, while also allow you to customize it in many important ways which might suit you best.

# [Demo page](http://dropthebit.com/demos/stickyfloat/stickyfloat.html)

##Benefits

* Can handle many floated elements, each with it’s own settings
* Floated elements’ movement can be bound inside their parents’ area
* Uses Native javascript easing, but using CSS3 transitions would be the optimum (not for IE)
* Has many settings, such as stick to the bottom or animation style
* Code is very maintainable and higly efficient

##Example – initialize
    jQuery('.menu').stickyfloat( {duration: 400} );
    
##Example – update (change settings for a specific element)
    jQuery('.menu').stickyfloat('update',{duration : 0, stickToBottom:true });

##Example – destroy (no more floating)
    jQuery('.menu').stickyfloat('destroy');

##Parameters

*duration (200)*
    The duration of the animation
*startOffset (number)*  
    The amount of scroll offset after the animations kicks in
*offsetY (number)*
    The offset from the top when the object is animated
*lockBottom (true)* 
    Set to false if you don’t want your floating box to stop at parent’s bottom
*stickToBottom (false)*
    Make whatever that is “floating” sticl top the bottom instead to the top 
*delay (0)*
    Delay in milliseconds until the animnations starts  
*easing (linear)* 
    Easing function (jQuery has by default only ‘swing’ & ‘linear’) 
*cssTransition (false)*
    if you wish to manualy set your own CSS3 transion styles on the floated element, flag this setting as ‘true’
