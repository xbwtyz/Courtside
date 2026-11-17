  // Phase 4E: isolated glossary state; one self-contained esbuild bundle.
  const courtsideStatGlossary = CourtsideStatGlossary.createStatGlossary({
    document, window, Node, MutationObserver, requestAnimationFrame, safe
  });
