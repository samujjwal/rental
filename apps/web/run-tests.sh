#!/bin/bash

# Comprehensive E2E Test Runner
# Usage: ./run-tests.sh [option]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

print_header() {
    echo ""
    print_color "$BLUE" "═══════════════════════════════════════════════════════"
    print_color "$BLUE" "  $1"
    print_color "$BLUE" "═══════════════════════════════════════════════════════"
    echo ""
}

print_success() {
    print_color "$GREEN" "✓ $1"
}

print_error() {
    print_color "$RED" "✗ $1"
}

print_warning() {
    print_color "$YELLOW" "⚠ $1"
}

# Check if dev server is running
check_server() {
    if curl -s http://localhost:3401 > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Start dev server if not running
ensure_server() {
    if check_server; then
        print_success "Development server is running"
    else
        print_warning "Development server not running. Starting..."
        pnpm dev &
        SERVER_PID=$!
        
        # Wait for server to be ready
        for i in {1..30}; do
            if check_server; then
                print_success "Development server started"
                return 0
            fi
            sleep 2
        done
        
        print_error "Failed to start development server"
        exit 1
    fi
}

# Run all tests
run_all() {
    print_header "Running All E2E Tests"
    pnpm playwright test
}

# Run form validation tests
run_validation() {
    print_header "Running Form Validation Tests"
    pnpm playwright test comprehensive-form-validation
}

# Run user journey tests
run_journeys() {
    print_header "Running User Journey Tests"
    pnpm playwright test comprehensive-user-journeys
}

# Run edge case tests
run_edge_cases() {
    print_header "Running Edge Case Tests"
    pnpm playwright test comprehensive-edge-cases
}

# Run specific feature tests
run_auth() {
    print_header "Running Authentication Tests"
    pnpm playwright test auth.spec
}

run_bookings() {
    print_header "Running Booking Tests"
    pnpm playwright test renter-booking-journey
}

run_listings() {
    print_header "Running Listing Tests"
    pnpm playwright test owner-listings
}

# Run quick smoke test
run_smoke() {
    print_header "Running Smoke Tests"
    pnpm playwright test --grep "@smoke"
}

# Run in headed mode
run_headed() {
    print_header "Running Tests in Headed Mode"
    pnpm playwright test --headed
}

# Run in debug mode
run_debug() {
    print_header "Running Tests in Debug Mode"
    pnpm playwright test --debug "$@"
}

# Run on specific browser
run_chromium() {
    print_header "Running Tests on Chromium"
    pnpm playwright test --project=chromium
}

run_firefox() {
    print_header "Running Tests on Firefox"
    pnpm playwright test --project=firefox
}

run_webkit() {
    print_header "Running Tests on WebKit/Safari"
    pnpm playwright test --project=webkit
}

# Run mobile tests
run_mobile() {
    print_header "Running Mobile Tests"
    pnpm playwright test --project="Mobile Chrome" --project="Mobile Safari"
}

# Run with UI
run_ui() {
    print_header "Running Tests with UI Mode"
    pnpm playwright test --ui
}

# Generate report
show_report() {
    print_header "Opening Test Report"
    npx playwright show-report
}

# Update snapshots
update_snapshots() {
    print_header "Updating Test Snapshots"
    pnpm playwright test --update-snapshots
}

# Show usage
show_usage() {
    cat << EOF
${BLUE}Comprehensive E2E Test Runner${NC}

Usage: ./run-tests.sh [option]

${GREEN}Test Suites:${NC}
  all              Run all E2E tests (default)
  validation       Run form validation tests
  journeys         Run user journey tests
  edge-cases       Run edge case and error scenario tests
  smoke            Run quick smoke tests

${GREEN}Feature Tests:${NC}
  auth             Run authentication tests
  bookings         Run booking flow tests
  listings         Run listing management tests

${GREEN}Browser Options:${NC}
  chromium         Run tests on Chromium
  firefox          Run tests on Firefox
  webkit           Run tests on WebKit/Safari
  mobile           Run mobile browser tests

${GREEN}Execution Modes:${NC}
  headed           Run tests with visible browser
  debug            Run tests in debug mode
  ui               Run tests with interactive UI

${GREEN}Utilities:${NC}
  report           Show last test report
  update-snapshots Update visual snapshots
  help             Show this help message

${YELLOW}Examples:${NC}
  ./run-tests.sh                    # Run all tests
  ./run-tests.sh validation         # Run validation tests only
  ./run-tests.sh headed             # Run with visible browser
  ./run-tests.sh debug auth         # Debug auth tests
  ./run-tests.sh chromium journeys  # Run journeys on Chrome

${BLUE}Prerequisites:${NC}
  - Development server running on http://localhost:3401
  - Or it will be started automatically

EOF
}

# Main script logic
main() {
    cd "$(dirname "$0")"
    
    # Ensure we're in the web app directory
    if [ ! -f "playwright.config.ts" ]; then
        print_error "playwright.config.ts not found. Please run from apps/web directory"
        exit 1
    fi
    
    # Parse arguments
    COMMAND=${1:-all}
    shift || true
    
    case "$COMMAND" in
        all)
            ensure_server
            run_all
            ;;
        validation)
            ensure_server
            run_validation
            ;;
        journeys)
            ensure_server
            run_journeys
            ;;
        edge-cases)
            ensure_server
            run_edge_cases
            ;;
        smoke)
            ensure_server
            run_smoke
            ;;
        auth)
            ensure_server
            run_auth
            ;;
        bookings)
            ensure_server
            run_bookings
            ;;
        listings)
            ensure_server
            run_listings
            ;;
        chromium)
            ensure_server
            run_chromium
            ;;
        firefox)
            ensure_server
            run_firefox
            ;;
        webkit)
            ensure_server
            run_webkit
            ;;
        mobile)
            ensure_server
            run_mobile
            ;;
        headed)
            ensure_server
            run_headed
            ;;
        debug)
            ensure_server
            run_debug "$@"
            ;;
        ui)
            ensure_server
            run_ui
            ;;
        report)
            show_report
            ;;
        update-snapshots)
            ensure_server
            update_snapshots
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "Unknown command: $COMMAND"
            echo ""
            show_usage
            exit 1
            ;;
    esac
    
    # Cleanup
    if [ ! -z "$SERVER_PID" ]; then
        print_warning "Stopping development server..."
        kill $SERVER_PID 2>/dev/null || true
    fi
}

# Run main function
main "$@"
