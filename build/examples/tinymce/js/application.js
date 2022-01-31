$(function () {
  tinymce.init({ 
    selector: '.tinymce'
  });

  $('.tjsbutton').click(function () {
    $('#nynjacb-dock').toggle();
  });
});
