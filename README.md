# Quill ImageDrop Module

A module for Quill rich text editor to allow images to be pasted and drag/dropped into the editor.


## Usage

### Webpack/ES6

```javascript
const quill = new Quill(editor, {
    // ...
    modules: {
        // ...
        imageDrop: true,
        imageResize: {
            displaySize: true
        },
    }
});
```

### Script Tag

Copy image-drop-resize.js into your web root 

```html
<script src="/node_modules/quill-image-drop-module/image-drop-resize.js"></script>
```

```javascript
var quill = new Quill(editor, {
    // ...
    modules: {
        // ...
        imageDrop: true,
        imageResize: {
            displaySize: true
        },
    }
});
```