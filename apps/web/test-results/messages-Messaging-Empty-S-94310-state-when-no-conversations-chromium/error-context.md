# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - region "Notifications alt+T"
  - generic [ref=e6]:
    - generic [ref=e7]:
      - link "Rental Portal" [ref=e8] [cursor=pointer]:
        - /url: /
        - heading "Rental Portal" [level=1] [ref=e9]
      - paragraph [ref=e10]: Welcome back! Please sign in.
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - text: Email Address
          - textbox "Email Address" [ref=e14]:
            - /placeholder: you@example.com
        - generic [ref=e15]:
          - text: Password
          - generic [ref=e16]:
            - textbox "Password" [ref=e17]:
              - /placeholder: •••••••••
            - button [ref=e18]:
              - img [ref=e19]
        - generic [ref=e23]:
          - checkbox "Remember me" [ref=e24]
          - text: Remember me
        - link "Forgot password?" [ref=e26] [cursor=pointer]:
          - /url: /auth/forgot-password
        - button "Sign In" [ref=e27]:
          - img [ref=e28]
          - text: Sign In
      - paragraph [ref=e32]:
        - text: Don't have an account?
        - link "Sign up" [ref=e33] [cursor=pointer]:
          - /url: /auth/signup
```