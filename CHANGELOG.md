# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-29

### Added
- **Responsive Scaling**: Module automatically scales based on region width using CSS Container Queries
- **Multi-column Layout**: Full-width positions (`top_bar`, `bottom_bar`, `fullscreen_above`, `fullscreen_below`, `upper_third`, `middle_center`, `lower_third`) display days side-by-side
- **Position-aware Styling**: Right-side positions get right-aligned headers with justified text
- **Stacked Date Headers**: Full-width positions show weekday and date on separate lines for cleaner appearance

### Changed
- Replaced `axios` dependency with built-in `fetch` (requires Node.js 18+)
- Updated `lookAhead` logic to properly use `endDay` and respect `hideTodayAfter` time

### Fixed
- Fixed `lookAhead` not triggering correctly on weekends when `startDay` was set to Sunday
- Fixed `lookAhead` triggering too early (now waits until after `hideTodayAfter` time on `endDay`)

### Removed
- Removed `axios` dependency - module now has zero runtime dependencies (no `npm install` required)

## [1.0.0] - Initial Release

### Added
- Display school breakfast and lunch menus from MealViewer API
- Configurable date range (`startDay`, `endDay`)
- Filter options: partial match, item type, exact name, starts with
- `showTodayOnly` mode
- `hideTodayAfter` time-based filtering
- `lookAhead` feature to show next week's menu
- `maxDisplayDays` limit
- `collapseEmptyMeals` option
- Support for multiple school instances
- Test mode for development