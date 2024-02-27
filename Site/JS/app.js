window.addEventListener('scroll', e => {
	document.body.style.cssText += `--scrolTop: ${this.scrollY}px`
}) 
gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
ScrollSmoother.create({
	wrapper: '.wrapper',
	content: '.content'
})
