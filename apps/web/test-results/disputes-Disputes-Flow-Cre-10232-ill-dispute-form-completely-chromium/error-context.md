# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - region "Notifications alt+T"
  - generic [ref=e5]:
    - banner [ref=e6]:
      - generic [ref=e8]:
        - link "Rental Portal" [ref=e9] [cursor=pointer]:
          - /url: /
        - link "Dashboard" [ref=e10] [cursor=pointer]:
          - /url: /dashboard
    - generic [ref=e11]:
      - button "My Rentals" [ref=e14]
      - generic [ref=e16]:
        - button "All" [ref=e17]
        - button "pending owner approval" [ref=e18]
        - button "pending payment" [ref=e19]
        - button "confirmed" [ref=e20]
        - button "active" [ref=e21]
        - button "return requested" [ref=e22]
        - button "completed" [ref=e23]
        - button "cancelled" [ref=e24]
      - generic [ref=e26]:
        - generic [ref=e27]: 📅
        - heading "You have no bookings yet" [level=3] [ref=e28]
        - paragraph [ref=e29]: Start exploring items to rent!
        - link "Browse Listings" [ref=e31] [cursor=pointer]:
          - /url: /search
          - button "Browse Listings" [ref=e32]:
            - generic [ref=e33]: Browse Listings
```