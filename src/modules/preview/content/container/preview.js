window.addEventListener("message", function(event)
{
    console.log('111111111111111');
    alert('22222222');
    document.open();
    document.write(event.data);
    document.close();
});