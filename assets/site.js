/* ORTOTATTILE — behaviour for the static rebuild (menus, overlays, slideshow, dragging, image zoom). */
(function () {
	'use strict';
	var html = document.documentElement;

	// ------------------------------------------------------------ phone / desktop switch
	function setMobile() { html.classList.toggle('mobile', window.innerWidth < 768); }
	setMobile();
	window.addEventListener('resize', setMobile);

	// ------------------------------------------------------------ overlays
	var overlays = {};
	document.querySelectorAll('.overlay').forEach(function (o) { overlays[o.dataset.overlayId] = o; });
	var stack = 0;

	function openOverlay(id) {
		var o = overlays[id];
		if (!o) return;
		if (o.dataset.closeOthers) Object.keys(overlays).forEach(function (k) { if (k !== id) closeOverlay(k); });
		o.style.zIndex = ++stack;
		o.scrollTop = 0;
		o.classList.add('open');
	}
	function closeOverlay(id) {
		var o = overlays[id];
		if (o) o.classList.remove('open');
	}
	function toggleOverlay(id) {
		var o = overlays[id];
		if (o && o.classList.contains('open')) closeOverlay(id); else openOverlay(id);
	}

	document.addEventListener('click', function (e) {
		if (justDragged) { e.preventDefault(); e.stopPropagation(); justDragged = false; return; }
		var a = e.target.closest('a');
		if (a) {
			if (a.hasAttribute('data-overlay')) {
				e.preventDefault();
				toggleOverlay(a.getAttribute('data-overlay'));
				return;
			}
			if (a.hasAttribute('data-close-overlay')) {
				e.preventDefault();
				var o = a.closest('.overlay');
				if (o) closeOverlay(o.dataset.overlayId);
				return;
			}
			if (a.hasAttribute('data-top')) {
				e.preventDefault();
				var ov = a.closest('.overlay');
				(ov || window).scrollTo({ top: 0, behavior: 'smooth' });
				return;
			}
		}
		// click outside an overlay's box closes it
		Object.keys(overlays).forEach(function (k) {
			var o = overlays[k];
			if (!o.classList.contains('open') || o.dataset.clickout !== '1') return;
			var box = o.querySelector('.page-content');
			if (!box.contains(e.target)) closeOverlay(k);
		});
	});
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Escape' || !qv.hidden) return;
		var top = null, z = -1;
		Object.keys(overlays).forEach(function (k) {
			var o = overlays[k];
			if (o.classList.contains('open') && +o.style.zIndex > z) { z = +o.style.zIndex; top = k; }
		});
		if (top) closeOverlay(top);
	});

	// menu shows once per visit; overlay URLs (/photos etc.) open that overlay
	var wanted = document.body.dataset.open;
	try {
		if (!sessionStorage.getItem('orto-seen')) {
			Object.keys(overlays).forEach(function (k) { if (overlays[k].dataset.openOnLoad) openOverlay(k); });
			sessionStorage.setItem('orto-seen', '1');
		}
	} catch (err) {}
	if (wanted) openOverlay(wanted);

	// ------------------------------------------------------------ slideshow
	document.querySelectorAll('gallery-slideshow').forEach(function (s) {
		var items = Array.prototype.slice.call(s.querySelectorAll('media-item'));
		if (!items.length) return;
		s.style.setProperty('--speed', (parseFloat(s.dataset.speed) || 0.4) + 's');
		var i = 0, tallest = 0;
		items.forEach(function (m) {
			var im = m.querySelector('img');
			var r = im.getAttribute('height') / im.getAttribute('width');
			if (r > tallest) tallest = r;
		});
		s.style.aspectRatio = '1 / ' + tallest;
		items[0].classList.add('on');
		function show(n) {
			items[i].classList.remove('on');
			i = (n + items.length) % items.length;
			items[i].classList.add('on');
		}
		s.addEventListener('mousemove', function (e) {
			var r = s.getBoundingClientRect();
			s.classList.toggle('prev-zone', e.clientX - r.left < r.width / 2);
		});
		s.addEventListener('click', function (e) {
			var r = s.getBoundingClientRect();
			show(i + (e.clientX - r.left < r.width / 2 ? -1 : 1));
		});
	});

	// ------------------------------------------------------------ dragging
	var justDragged = false;
	document.querySelectorAll('[data-drag]').forEach(function (el) {
		var sx, sy, ox = 0, oy = 0, moved = false, active = false;
		el.addEventListener('pointerdown', function (e) {
			if (e.button !== 0) return;
			active = true; moved = false;
			sx = e.clientX; sy = e.clientY;
		});
		window.addEventListener('pointermove', function (e) {
			if (!active) return;
			var dx = e.clientX - sx, dy = e.clientY - sy;
			if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
			if (!moved) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
			moved = true;
			el.classList.add('dragging');
			el.style.setProperty('--tx', (ox + dx) + 'px');
			el.style.setProperty('--ty', (oy + dy) + 'px');
		});
		function end(e) {
			if (!active) return;
			active = false;
			el.classList.remove('dragging');
			if (moved) {
				ox += e.clientX - sx; oy += e.clientY - sy;
				justDragged = true;
				setTimeout(function () { justDragged = false; }, 0);
			}
		}
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', end);
		el.addEventListener('dragstart', function (e) { e.preventDefault(); });
	});

	// ------------------------------------------------------------ image zoom (quick view)
	var qv = document.querySelector('.quick-view-wrap');
	var qvImg = qv.querySelector('img');
	var group = [], gi = 0;
	function qvShow(n) {
		gi = (n + group.length) % group.length;
		qvImg.src = group[gi].querySelector('img').currentSrc || group[gi].querySelector('img').src;
	}
	function qvClose() { qv.hidden = true; qvImg.removeAttribute('src'); }
	document.addEventListener('click', function (e) {
		var m = e.target.closest('media-item.zoomable');
		if (!m || m.closest('gallery-slideshow')) return;
		e.preventDefault();
		group = Array.prototype.slice.call(m.closest('.page').querySelectorAll('media-item.zoomable'));
		qvShow(group.indexOf(m));
		qv.hidden = false;
	});
	qv.addEventListener('click', function (e) {
		e.stopPropagation();
		if (e.target.closest('.qv-close') || group.length < 2) return qvClose();
		var r = qv.getBoundingClientRect();
		if (e.clientX < r.width * 0.25) qvShow(gi - 1);
		else if (e.clientX > r.width * 0.75) qvShow(gi + 1);
		else qvClose();
	});
	document.addEventListener('keydown', function (e) {
		if (qv.hidden) return;
		if (e.key === 'Escape') qvClose();
		if (e.key === 'ArrowRight') qvShow(gi + 1);
		if (e.key === 'ArrowLeft') qvShow(gi - 1);
	});

	// ------------------------------------------------------------ audio player
	var PLAY = '<svg viewBox="0 0 10 12"><path d="M0 0l10 6-10 6z"/></svg>';
	var PAUSE = '<svg viewBox="0 0 10 12"><path d="M0 0h3.5v12H0zM6.5 0H10v12H6.5z"/></svg>';
	document.querySelectorAll('audio-player').forEach(function (p) {
		var audio = new Audio();
		audio.preload = 'none';
		audio.src = p.dataset.src;
		p.innerHTML = '<button class="ap-btn" aria-label="Play">' + PLAY + '</button>' +
			'<div class="ap-track"><div class="ap-progress"></div><span class="ap-label"></span></div>';
		p.querySelector('.ap-label').textContent = p.dataset.label || '';
		var btn = p.querySelector('.ap-btn'), track = p.querySelector('.ap-track'), bar = p.querySelector('.ap-progress');
		btn.addEventListener('click', function () { if (audio.paused) audio.play(); else audio.pause(); });
		audio.addEventListener('play', function () { btn.innerHTML = PAUSE; btn.setAttribute('aria-label', 'Pause'); });
		audio.addEventListener('pause', function () { btn.innerHTML = PLAY; btn.setAttribute('aria-label', 'Play'); });
		audio.addEventListener('timeupdate', function () {
			if (audio.duration) bar.style.width = (audio.currentTime / audio.duration * 100) + '%';
		});
		track.addEventListener('click', function (e) {
			var r = track.getBoundingClientRect();
			if (!audio.duration) { audio.play(); return; }
			audio.currentTime = (e.clientX - r.left) / r.width * audio.duration;
		});
	});
})();
