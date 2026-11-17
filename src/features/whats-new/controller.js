  // Courtside 1.7 modularization pilot: the controller's mutable state is private.
  // Only these four public commands remain visible to existing Settings handlers.
  const { initWhatsNew, renderWhatsNew, markWhatsNewRead, updateWhatsNewIndicators } =
    CourtsideWhatsNew.createWhatsNew({ $, safe, releases: WHATS_NEW_RELEASES,
      currentRelease: COURTSIDE_RELEASE, getStorage: () => localStorage });
