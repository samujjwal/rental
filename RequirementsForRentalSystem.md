Requirements for Rental System
1.      High Level Vision
a.      View available products / services to rent
b.      See details like price, description, availability dates
c.       Choose category (cars, trucks, clothes, homes etc)
d.      Book and pay online
e.      Leave ratings and reviews
 
2.      Allow owners / vendors to:
a.      Sign up and list their items
b.      Set their own rental prices and availability
c.       View their earnings and bookings
 
3.      User Roles
Role
Function
Customer / Renter
Searches, books, pays to rent item
Owner / Vendor
Lists things to rent, manages bookings
Admin / System Manager
Oversees platform, approves listings, handles disputes

 
4.      Features
a.      Browse and Search
i.                    Users can filter by category (vehicle, clothing, house etc)
ii.                   Search with keywords (eg. Traditional clothes for grade 2 students for parents’ day)
iii.                 Filter by price, date, location
b.      Item Page
Every item listing should show:
i.                    Title and Description
ii.                   Photos
iii.                 Rental price per hour / day/ week / or other relevant units
iv.                 Availability Calendar
v.                   Owner info (to be discussed)
vi.                 Terms and Rules
c.       Booking and Payment
i.                    Users can select dates and book
ii.                   System calculates total price (applicable VAT and Tax should be clearly visible with separate headings)
iii.                 Online Payments
iv.                 Booking confirmation to be displayed in the browser and the confirmation should be sent through email / SMS
d.      User Accounts
i.                    Customers and owners can create profiles
ii.                   Save booking history
iii.                 Add payment methods
iv.                 Owners can see earnings
e.      Ratings and Reviews
i.                    Customers rate items and owners rate customers
ii.                   Overall rating shown publicly
f.        Admin Dashboard
Admin should be able to:
i.                    Approve or reject listings
ii.                   Manage disputes and refunds
iii.                 View analytics (total bookings, revenue, users etc)
 
5.      Special Needs for Each Category
a.      Vehicle and Truck Rental
i.                    Location pickup and drop off options
ii.                   Insurance options
iii.                 Driving license verification
b.      Clothing Rental
i.                    Sizes and measurement fields
ii.                   Condition checklist (before and after rental)
iii.                 Dry cleaning instructions
c.       House / Apartment Rental
i.                    Check in / check out rules
ii.                   Security deposit handling
iii.                 Calendar blocking for bookings
6.      Functional Requirements - Users
6.1.            User and Credential Creation Module
a.      General Account Requirements (All Users)
The system shall support three user roles:
i.                    Customer (Renter)
ii.                   Owner (Vendor)
iii.                 Admin
Each role shall have separate access permissions.
6.2.            Registration Methods
The system shall allow users to register using:
i.                    Email + password
ii.                   Mobile number + OTP verification
iii.                 Social login (Google / Apple / Facebook etc)
6.3.            Unique Identity
i.                    Each user must have a unique email address
ii.                   Each user must have a unique mobile number
iii.                 The system shall prevent duplicate accounts using same credentials
6.4.            Password Policy
i.                    Minimum 8 characters
ii.                   At least 1 uppercase letter
iii.                 At least 1 number
iv.                 At least 1 special character
v.                   Password encryption in database
6.5.            Account Verification
i.                    Send email verification link after registration
ii.                   Send mobile OTP for phone verification
iii.                 Prevent booking / listing until verification is completed
6.6.            Login and Authentication
The system shall allow:
i.                    Allow login via registered credentials
ii.                   Support “Forgot Password”
iii.                 Support OTP based login
iv.                 Lock account after X failed login attempts
v.                   Enable session timeout after inactivity
6.7.            Multi Factor Authentication (to be discussed)
i.                    System shall support 2FA via SMS or Authenticator App
ii.                   Admin accounts must require mandatory 2FA
7.      Functional Requiremnts – Customer (Renter) Account Requirements
7.1.            Customer Registration Data
i.                    Full Name
ii.                   Email
iii.                 Mobile Number
iv.                 Password
v.                   Date of Birth
vi.                 Gender (Optional)
vii.               Profile photo (Optional)
7.2.            Identity Verification
The system shall allow customers to upload:
i.                    Government ID
ii.                   Driving License (mandatory for vehicle / truck rental)
iii.                 Address proof
iv.                 PAN certificate
Admin shall approve / reject verification
7.3.            Customer Profile Management
Customer shall be able to:
i.                    Edit personal details
ii.                   Change password
iii.                 Add multiple delivery addresses
iv.                 Upload / update documents
v.                   Add profile picture
7.4.            Payment Credentials:
Customers shall be able to:
i.                    Add credit / debit cards
ii.                   Add wallet account (to be discussed)
iii.                 View payment history
iv.                 Save preferred payment method
v.                   Remove saved payment methods
7.5.            Booking History
Customer shall view:
i.                    Upcoming bookings
ii.                   Past bookings / rentals
iii.                 Cancelled bookings
iv.                 Refund history
v.                   Invoice download (PDF)
7.6.            Account Status
Admin shall be able to:
i.                    Suspend customer
ii.                   Block customer
iii.                 Flag customer for suspicious activity
8.      Functional Requirement – Owner (Vendor) Requirements
8.1.            Owner Registration Data
The system shall collect:
i.                    Full Name
ii.                   Business Name (mandatory or optional to be discussed)
iii.                 Email
iv.                 Mobile Number
v.                   Password
vi.                 Business address
vii.               PAN ID
8.2.            Business Verification
Owner shall upload:
i.                    Government ID
ii.                   Business registration certificate (if company)
iii.                 PAN / VAT number
iv.                 Bank account details for payouts
Admin approval is required before listing items
8.3.            Bank and Payout Credentials
Owner shall:
i.                    Add bank account details
ii.                   View earnings report
iii.                 View payout history
System shall:
i.                    Validate bank details
ii.                   Protect financial data security
8.4.            Profile and Business Management
Owner shall:
i.                    Upload profile photo or company logo
ii.                   Write business description
iii.                 Set rental policies
iv.                 Set cancellation policies
8.5.            Account permissions
Owners shall only:
i.                    Manage their own listings
ii.                   View their own bookings
iii.                 View their earnings
They shall not:
i.                    Access other vendors’ data
ii.                   Modify system settings
8.6.            Owner Performance Metrics
Owner dashboard shall show:
i.                    Total earnings
ii.                   Number of rentals
iii.                 Average rating
iv.                 Active listings
9.      Functional Requirements – Admin Account Requirements
9.1.            Admin Creation
Admin account shall:
i.                    Be created only by super admin
ii.                   Not allow public registration
9.2.            Admin Authentication
Admin login shall require
i.                    Email + Password
ii.                   Mandatory 2FA
iii.                 IP logging
iv.                 Login activity tracking
9.3.            Admin Role Levels
System shall support:
i.                    Super Admin
ii.                   Operations Admin
iii.                 Finance Admin
iv.                 Support Admin
Each role shall have permission-based access
9.4.            Admin Capabilities
          	Admin shall be able to:
i.                    Approve / reject users
ii.                   Suspend users
iii.                 Reset passwords
iv.                 Access all bookings
v.                   Process refunds
vi.                 Manage disputes
vii.               Generate reports
viii.             View revenue analytics
9.5.            Audit Logs
i.                    Record all admin actions
ii.                   Store timestamp, IP address, user ID
iii.                 Prevent deletion of audit logs
10.  Functional Requirements: Security and Credential Management Requirements
10.1.        Encryption
i.                    All passwords must be encrypted
ii.                   Sensitive data must be encrypted at rest
iii.                 Payment data must comply with PCI standards
10.2.        Session Management
i.                    Auto logout after inactivity (e.g. 10-15 mins)
ii.                   Prevent simultaneous logins (to be discussed)
iii.                 Secure token-based authentication
10.3.        Account Recovery
i.                    Password reset via email link
ii.                   OPT verification for password reset
iii.                 Admin assisted account recovery
10.4.        Data Privacy
i.                    Allow users to delete account (with data retention rules)
ii.                   Provide data export option
iii.                 Comply with privacy laws
10.5.        Fraud Detection:
i.                    Detect multiple accounts from same IP
ii.                   Flag unusual booking behavior
iii.                 Alert admin for suspicious activity
11.  Functional Requiremtn – Vehicle Rental
11.1.        User Registration and Account Management
The System shall allow users to register as:
i.                    Customer (Renter)
ii.                   Vehicle Owner (Vendor)
The system shall allow login via
iii.                 Email + Password
iv.                 Mobile Number + OTP
v.                   Social login
The system shall allow customers to upload:
vi.                 Driving license (mandatory)
vii.               ID Proof
viii.             PAN No / PAN certificate
 
11.2.        Vehicle Listing (Owner Side)
Owner shall be able to list a vehicle with:
i.                    Vehicle type (CAR, SUV, bike etc.)
ii.                   Brand and model
iii.                 Year of manufacture
iv.                 Transmission type
v.                   Fuel type
vi.                 Seating capacity
vii.               Registration number
viii.             Insurance details
ix.                 Photos (multiple)
x.                   Description
xi.                 Rental price (per hour/day/week)
xii.               Security deposit
xiii.             Pickup location
xiv.             Availability calendar
Owner shall be able to:
xv.               Edit listing
xvi.             Block dates
xvii.            Activate/ deactivate listing
11.3.        Search and Browse
Customer shall be able to search by:
i.                    Location
ii.                   Date and time
iii.                 Vehicle Type
iv.                 Price range
The system shall display
i.                    Available vehicles only
ii.                   Price breakdown
iii.                 Owner rating
11.4.        Booking and Payment
Customer shall select rental period (start/end date and time) and System shall Calculate:
i.                    Base rental cost
ii.                   Taxes
iii.                 Insurance (if selected)
iv.                 Security deposit
v.                   Total payable amount
System shall support online payments
i.                    Card
ii.                   Bank Transfer
iii.                 Wallets
Booking confirmation shall be sent via:
i.                    Email
ii.                   SMS
iii.                 In-app notification
11.5.        Pickup and Return Management
The system shall record:
i.                    Vehicle condition before backup (photos checklist)
ii.                   Odometer reading
On return:
i.                    Capture vehicle condition photos
ii.                   Capture final mileage
iii.                 Calculate extra charges (late return / extra mileage)
11.6.        Ratings and Reviews
i.                    Customer shall rate vehicle and owner
ii.                   Owner shall rate customer (renter)
11.7.        Admin Controls
Admin shall:
i.                    Approve/reject vehicle listings
ii.                   Suspend users
iii.                 Handle disputes
iv.                 Process refunds
12.  Functional Requirements- Truck / Delivery Van Rental (Additional requirements specific to commercial rentals)
12.1 Commercial Details
Owner shall specify:
i.          Load capacity (tons/kg)
ii.        Cargo dimensions
iii.      Driver included(yes/no)
iv.       Fuel policy
System shall allow customer to:
i.                    Choose self-drive or with drive
ii.                   Enger pickup and drop off location
12.2. Route and Distance
The system shall calculate estimated distance using map integration
The system shall estimate cost based on:
i.           Time
ii.          Distance
iii.        Fixed package pricing (optional)
12.3. Driver Management (if included)
Driver details must include
i.              Name
ii.             License
iii.           Contact number
Note: Driver assignment must be visible to customer before trip
12..4. Damage and Insurance
The system shall allow:
i.              Damage reporting
ii.             Uploading proof photos
iii.           Insurance claim process
13.  Functional Requirements – Clothing Rental
13.1.        Customer Registration
i.                    System shall allow customer to create account
ii.                   Email and mobile verification required before booking
13.2.        Owner Registration
i.                    System shall allow owner to create account
ii.                   Owner must submit ID and bank details
iii.                 Admin approval required before listing items
13.3.        Clothing Listing Management (Owner Side)
Owner shall input
i.                    Category (Wedding/ Party/Casual/Designer/ Ethnic/Traditional/Formal etc.)
ii.                   Gender (Men/Women/Kids/Unisex)
iii.                 Size (S, M, L, XL, Custom)
iv.                 Color
v.                   Brand
vi.                 Material
vii.               Occasion type
viii.             Rental price per day
ix.                 Security deposit
x.                   Cleaning fee (optional)
xi.                 Replacement value
xii.               Description
xiii.             Minimum rental duration
xiv.             Maximum rental duration
xv.               Available quantity
xvi.             Imagers (front/back/closeup/damage prone areas)
13.4.        Multiple Sizes of Same Item
System shall:
i.                    Allow same design with multiple sizes
ii.                   Track inventory per size separately
iii.                 Block only selected size after booking
13.5.        Availability Calendar
System shall:
i.                    Show availability calendar per size
ii.                   Automatically block booked dates
iii.                 Add cleaning buffer days after return (configurable)
13.6.        Inventory and Stock Management
If quantity =1 (Single Piece Inventory)
i.                    System shall block entire date range after booking
 13.1. Product Listing
If quantity >1 (Multiple Quantity Inventory)
i.                    System shall allow multiple simultaneous bookings
ii.                   System shall block booking when stock limit reached
13.7.        Maintenance Mode
Owner/Admin can:
i.                    Mark item “Under Maintenance”
ii.                   Temporarily remove item from listing
iii.                 Extend maintenance period
13.8.        Booking Scenarios
i.                    Standard Rental Booking
Customer selects:
a.      Size
b.      Rental start date
c.       Rental end date
d.      Delivery or pickup
System shall:
a.      Check size availability
b.      Add buffer cleaning days
c.       Calculate total price
ii.                   Lat Minute Booking
System shall
a.      Prevent same day booking if preparation time is not sufficient OR
b.      Allow express rental with additional fee
iii.                 Advance Booking (Months Ahead)
a.      System shall allow future date booking up to configurable limit (e.g. 6-12 months)
iv.                 Partial Availability Conflict
a.      System shall show alternative sizes
b.      Suggest similar items
13.9.        Payments and Deposits
i.                    Security Deposit Hold
System shall
a.      Collect deposit amount
b.      Hold deposit until item is returned
c.       Release deposit after inspection
ii.                   Damage Deduction (if damage found)
a.      Owner uploads damage evidence
b.      Admin reviews
c.       Deduct damage cost from deposit
d.      Refund remaining amount
iii.                 Late Return Fee
System shall
a.      Calculate late fee per hour/day
b.      Deduct from deposit or charge payment method
13.10.    Delivery and Logistics
i.                    Home delivery
Customer selects:
a.      Delivery address
b.      Preferred time slot
c.       Mark item as “Delivered”
System shall:
a.      Assign curior
b.      Generate tracking ID
c.       Notify customer
ii.                   Store Pickup
System shall:
a.      Display pickup location
b.      Generate pickup QR code
c.       Mark item as “picked”
iii.                 Return Pickup
System shall:
a.      Schedule return pickup
b.      Send reminder notification
c.       Update status to “Returned”
13.11.    Condition Check
i.                    Before dispatch
a.      Owner uploads condition photos
b.      System timestamps images
ii.                   Return Inspection
After return:
a.      Compare with pre-dispatch photos
Mark as:
a.      Good condition
b.      Minor damage
c.       Major damage
13.12.    Cancellation
i.                    Customer Cancels Early
System shall:
a.      Apply cancellation policy
b.      Refund partial/full amount based on timing
ii.                   Owner Cancels Booking
System shall:
a.      Notify customer
b.      Redirect to other potential owners
c.       Provide full refund
d.      Penalize owner (to be discussed)
13.13.    Review and Rating
i.                    Customer Reviews Item
a.      Rate size accuracy
b.      Rate cleanliness
c.       Rate quality
ii.                   Owner Reviews Customer
a.      Rate timely return
b.      Rate item care
13.14.    Special Advanced Scenarios
i.                    Try-at-Home Option
a.      Customer requests trial before rental
b.      Trial fee, if applicable, charged
c.       Rental price adjusted if confirmed
ii.                   Subscription Rental Modal
a.      Monthly subscription plan
b.      Customer can rent x items per month
c.       System tracks usage limits
iii.                 Lost item
If item not returned:
a.      System marks as “Lost”
b.      Charge full replacement value
c.       Blacklist user (optional, to be discussed)
iv.                 Hygiene and Cleaning tracking
System shall
a.      Track cleaning status
b.      Prevent booking if not cleaned
c.       Log cleaning vendor details
13.15.    Admin Control
Admin Shall:
i.                    Monitor stock levels
ii.                   Override booking
iii.                 Process manual refund
iv.                 Handle disputes
v.                   Generate damage reports
vi.                 View revenue by category
vii.               Track most rented sizes
viii.             View pending returns
ix.                 View high risk customers
13.16.    Complete Rental flow
i.                    Owner registers
ii.                   Owner lists clothing with size and quantity
iii.                 Admin approves
iv.                 Customer registers
v.                   Customer selects size and date
vi.                 System checks availability
vii.               Customer pays + deposit
viii.             Owner prepares and uploads condition photos
ix.                 Item picked up or delivered
x.                   Customer uses item
xi.                 Return pickup
xii.               Condition check
xiii.             Deposit refund
xiv.             Reviews
14.  Common functional Requirements (All Categories)
14.1.        Notificaitons
i.                    Booking confirmation
ii.                   Reminder before rental start
iii.                 Return reminder
iv.                 Payment confirmation
v.                   Refund confirmation
14.2.        Cancellation and Refund
i.                    Allow cancellation before defined time
ii.                   Apply cancellation policy
iii.                 Partial or full refund calculation
14.3.        Security Deposit Handling
i.                    Hold deposit
ii.                   Release deposit after successful return
iii.                 Deduct if damaged
14.4.        Reports and Analytics
Admin should see:
i.                    Total bookings
ii.                   Revenue per category
iii.                 Active users
iv.                 Most rented items
v.                   Least rented items
Vendor should see:
i.                    Earnings
ii.                   Upcoming bookings
iii.                 Rental history
Renter should see:
i.                    Rent history
ii.                   Expenditures
iii.                 Promotions and publicity materials pushed by the service providers
14.5.        Dispute Management
i.                    Raise complaint
ii.                   Upload evidence
iii.                 Admin resolution system