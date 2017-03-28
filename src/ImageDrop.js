/**
 * Custom module for quilljs to allow user to drag images from their file system into the editor
 * and paste images from clipboard (Works on Chrome, Firefox, Edge, not on Safari)
 * @see https://quilljs.com/blog/building-a-custom-module/
 */
export class ImageDrop {

	/**
	 * Instantiate the module given a quill instance and any options
	 * @param {Quill} quill
	 * @param {Object} options
	 */
	constructor(quill, options = {}) {
		// save the quill reference
		this.quill = quill;
		// bind handlers to this instance
		this.handleDrop = this.handleDrop.bind(this);
		this.handlePaste = this.handlePaste.bind(this);
		// listen for drop and paste events
		this.quill.root.addEventListener('drop', this.handleDrop, false);
		this.quill.root.addEventListener('paste', this.handlePaste, false);
	}

	/**
	 * Handler for drop event to read dropped files from evt.dataTransfer
	 * @param {Event} evt
	 */
	handleDrop(evt) {
		evt.preventDefault();
		if (evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files.length) {
			this.readFiles(evt.dataTransfer.files, this.insert.bind(this));
		}
	}

	/**
	 * Handler for paste event to read pasted files from evt.clipboardData
	 * @param {Event} evt
	 */
	handlePaste(evt) {
		if (evt.clipboardData && evt.clipboardData.items && evt.clipboardData.items.length) {
			this.readFiles(evt.clipboardData.items, dataUrl => {
				const selection = this.quill.getSelection();
				if (selection) {
					// we must be in a browser that supports pasting (like Firefox)
					// so it has already been placed into the editor
				}
				else {
					// otherwise we wait until after the paste when this.quill.getSelection()
					// will return a valid index
					setTimeout(() => this.insert(dataUrl), 0);
				}
			});
		}
	}

	/**
	 * Insert the image into the document at the current cursor position
	 * @param {String} dataUrl  The base64-encoded image URI
	 */
	insert(dataUrl) {
		const index = (this.quill.getSelection() || {}).index || this.quill.getLength();
		this.quill.insertEmbed(index, 'image', dataUrl, 'user');
	}

	/**
	 * Extract image URIs a list of files from evt.dataTransfer or evt.clipboardData
	 * @param {File[]} files  One or more File objects
	 * @param {Function} callback  A function to send each data URI to
	 */
	readFiles(files, callback) {
		// check each file for an image
		[].forEach.call(files, file => {
			if (!file.type.match(/^image\/(gif|jpe?g|a?png|svg|webp|bmp|vnd\.microsoft\.icon)/i)) {
				// file is not an image
				// Note that some file formats such as psd start with image/* but are not readable
				return;
			}
			// set up file reader
			const reader = new FileReader();
			reader.onload = (evt) => {
				callback(evt.target.result);
			};
			// read the clipboard item or file
			const blob = file.getAsFile ? file.getAsFile() : file;
			if (blob instanceof Blob) {
				reader.readAsDataURL(blob);
			}
		});
	}

}

/**
 * Custom module for quilljs to allow user to resize <img> elements
 * (Works on Chrome, Edge, Safari and replaces Firefox's native resize behavior)
 * @see https://quilljs.com/blog/building-a-custom-module/
 * author https://github.com/kensnyder
 */
export class ImageResize {

	constructor(quill, options = {}) {
		// save the quill reference and options
		this.quill = quill;
		this.options = options;
		// bind handlers to this instance
		this.handleClick = this.handleClick.bind(this);
		this.handleMousedown = this.handleMousedown.bind(this);
		this.handleMouseup = this.handleMouseup.bind(this);
		this.handleDrag = this.handleDrag.bind(this);
		this.checkImage = this.checkImage.bind(this);
		// track resize handles
		this.boxes = [];
		// disable native image resizing on firefox
		document.execCommand('enableObjectResizing', false, 'false');
		// respond to clicks inside the editor
		this.quill.root.addEventListener('click', this.handleClick, false);
	}

	handleClick(evt) {
		if (evt.target && evt.target.tagName && evt.target.tagName.toUpperCase() == 'IMG') {
			if (this.img === evt.target) {
				// we are already focused on this image
				return;
			}
			if (this.img) {
				// we were just focused on another image
				this.hide();
			}
			// clicked on an image inside the editor
			this.show(evt.target);
		}
		else if (this.img) {
			// clicked on a non image
			this.hide();
		}
	}

	show(img) {
		// keep track of this img element
		this.img = img;
		this.showResizers();
		this.showSizeDisplay();
		// position the resize handles at the corners
		const rect = this.img.getBoundingClientRect();
		this.positionBoxes(rect);
		this.positionSizeDisplay(rect);
	}

	hide() {
		this.hideResizers();
		this.hideSizeDisplay();
		this.img = undefined;
	}

	showResizers() {
		// prevent spurious text selection
		this.setUserSelect('none');
		// add 4 resize handles
		this.addBox('nwse-resize'); // top left
		this.addBox('nesw-resize'); // top right
		this.addBox('nwse-resize'); // bottom right
		this.addBox('nesw-resize'); // bottom left
		// listen for the image being deleted or moved
		document.addEventListener('keyup', this.checkImage, true);
		this.quill.root.addEventListener('input', this.checkImage, true);
	}

	hideResizers() {
		// stop listening for image deletion or movement
		document.removeEventListener('keyup', this.checkImage);
		this.quill.root.removeEventListener('input', this.checkImage);
		// reset user-select
		this.setUserSelect('');
		this.setCursor('');
		// remove boxes
		this.boxes.forEach(box => document.body.removeChild(box));
		// release memory
		this.dragBox = undefined;
		this.dragStartX = undefined;
		this.preDragWidth = undefined;
		this.boxes = [];
	}

	addBox(cursor) {
		// create div element for resize handle
		const box = document.createElement('div');
		// apply styles
		const styles = {
			position: 'absolute',
			height: '12px',
			width: '12px',
			backgroundColor: 'white',
			border: '1px solid #777',
			boxSizing: 'border-box',
			opacity: '0.80',
			cursor: cursor,
		};
		this.extend(box.style, styles, this.options.handleStyles || {});
		// listen for mousedown on each box
		box.addEventListener('mousedown', this.handleMousedown, false);
		// add drag handle to document
		document.body.appendChild(box);
		// keep track of drag handle
		this.boxes.push(box);
	}

	extend(destination, ...sources) {
		sources.forEach(source => {
			for (let prop in source) {
				if (source.hasOwnProperty(prop)) {
					destination[prop] = source[prop];
				}
			}
		});
		return destination;
	}

	positionBoxes(rect) {
		// set the top and left for each drag handle
		[
			{ left: rect.left - 6,              top: rect.top - 6 },               // top left
			{ left: rect.left + rect.width - 6, top: rect.top - 6 },               // top right
			{ left: rect.left + rect.width - 6, top: rect.top + rect.height - 6 }, // bottom right
			{ left: rect.left - 6,              top: rect.top + rect.height - 6 }, // bottom left
		].forEach((pos, idx) => {
			this.extend(this.boxes[idx].style, {
				top: Math.round(pos.top + window.pageYOffset) + 'px',
				left: Math.round(pos.left + window.pageXOffset) + 'px',
			});
		});
	}

	handleMousedown(evt) {
		// note which box
		this.dragBox = evt.target;
		// note starting mousedown position
		this.dragStartX = evt.clientX;
		// store the width before the drag
		this.preDragWidth = this.img.width || this.img.naturalWidth;
		// set the proper cursor everywhere
		this.setCursor(this.dragBox.style.cursor);
		// listen for movement and mouseup
		document.addEventListener('mousemove', this.handleDrag, false);
		document.addEventListener('mouseup', this.handleMouseup, false);
	}

	handleMouseup() {
		// reset cursor everywhere
		this.setCursor('');
		// stop listening for movement and mouseup
		document.removeEventListener('mousemove', this.handleDrag);
		document.removeEventListener('mouseup', this.handleMouseup);
	}

	handleDrag(evt) {
		if (!this.img) {
			// image not set yet
			return;
		}
		// update image size
		if (this.dragBox == this.boxes[0] || this.dragBox == this.boxes[3]) {
			// left-side resize handler; draging right shrinks image
			this.img.width = Math.round(this.preDragWidth - evt.clientX - this.dragStartX);
		}
		else {
			// right-side resize handler; draging right enlarges image
			this.img.width = Math.round(this.preDragWidth + evt.clientX - this.dragStartX);
		}
		// reposition the drag handles around the image
		const rect = this.img.getBoundingClientRect();
		this.positionBoxes(rect);
		this.positionSizeDisplay(rect);
	}

	setUserSelect(value) {
		[
			'userSelect',
			'mozUserSelect',
			'webkitUserSelect',
			'msUserSelect'
		].forEach(prop => {
			// set on contenteditable element and <html>
			this.quill.root.style[prop] = value;
			document.documentElement.style[prop] = value;
		});
	}

	setCursor(value) {
		[
			document.body,
			this.img,
			this.quill.root
		].forEach(el => el.style.cursor = value);
	}

	checkImage() {
		if (this.img) {
			this.hide();
		}
	}

	showSizeDisplay() {
		if (!this.options.displaySize) {
			return;
		}
		this.display = document.createElement('div');
		// apply styles
		const styles = {
			position: 'absolute',
			font: '12px/1.0 Arial, Helvetica, sans-serif',
			padding: '4px 8px',
			textAlign: 'center',
			backgroundColor: 'white',
			color: '#333',
			border: '1px solid #777',
			boxSizing: 'border-box',
			opacity: '0.80',
			cursor: 'default',
		};
		this.extend(this.display.style, styles, this.options.displayStyles || {});
		document.body.appendChild(this.display);
	}

	hideSizeDisplay() {
		document.body.removeChild(this.display);
		this.display = undefined;
	}

	positionSizeDisplay(rect) {
		if (!this.display || !this.img) {
			return;
		}
		const size = this.getCurrentSize();
		this.display.innerHTML = size.join(' &times; ');
		if (size[0] > 120 && size[1] > 30) {
			// position on top of image
			const dispRect = this.display.getBoundingClientRect();
			this.extend(this.display.style, {
				left: Math.round(rect.left + rect.width + window.pageXOffset - dispRect.width - 8) + 'px',
				top: Math.round(rect.top + rect.height + window.pageYOffset - dispRect.height - 8) + 'px',
			});
		}
		else {
			// position off bottom right
			this.extend(this.display.style, {
				left: Math.round(rect.left + rect.width + window.pageXOffset + 8) + 'px',
				top: Math.round(rect.top + rect.height + window.pageYOffset + 8) + 'px',
			});
		}
	}

	getCurrentSize() {
		return [
			this.img.width,
			Math.round(this.img.width / this.img.naturalWidth * this.img.naturalHeight),
		];
	}
}
Quill.register('modules/imageResize', ImageResize);

