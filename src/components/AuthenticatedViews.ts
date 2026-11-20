// Core authenticated map shell — loaded immediately upon login for fastest first map paint.
// Secondary tabs (ItinerariesView, SavedView, ProfileModal, SearchFilterDrawer, SpotDetailSheet)
// and rare modals/effects are code-split and idle-prefetched in App.tsx.
export { MapComponent } from './MapComponent';
export { BottomNavigation } from './BottomNavigation';
export { SpotPreviewBanner } from './SpotPreviewBanner';
export { DesktopSidebar } from './desktop/DesktopSidebar';
export { DesktopMapControls } from './desktop/DesktopMapControls';
export { DesktopExplorePanel } from './desktop/DesktopExplorePanel';
export { AirbnbPresentationCard } from './AirbnbPresentationCard';
export { XpRewardNotificationOverlay } from './XpRewardNotificationOverlay';
