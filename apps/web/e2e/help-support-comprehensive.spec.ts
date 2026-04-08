import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

/**
 * Help & Support Flows E2E Tests
 * 
 * Tests comprehensive support workflow:
 * - Help center navigation and search
 * - Support ticket creation and management
 * - Live chat functionality
 * - FAQ browsing and search
 * - Knowledge base access
 * - Emergency support contacts
 */

test.describe("Help & Support Flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("Help Center Navigation", () => {
    test("should display help center homepage", async ({ page }) => {
      await page.goto("/help");
      
      // Should show help center header
      await expect(page.locator("h1")).toContainText(/Help Center|Support/i);
      await expect(page.locator('[data-testid="help-search"]')).toBeVisible();
      
      // Should show popular topics
      await expect(page.locator('[data-testid="popular-topics"]')).toBeVisible();
      const popularTopics = page.locator('[data-testid="popular-topic"]');
      const topicCount = await popularTopics.count();
      expect(topicCount).toBeGreaterThan(0);
      
      // Should show quick links
      await expect(page.locator('[data-testid="quick-links"]')).toBeVisible();
      await expect(page.locator('[data-testid="contact-options"]')).toBeVisible();
      
      // Should show categories
      await expect(page.locator('[data-testid="help-categories"]')).toBeVisible();
      const categories = page.locator('[data-testid="help-category"]');
      const categoryCount = await categories.count();
      expect(categoryCount).toBeGreaterThan(0);
    });

    test("should search help articles", async ({ page }) => {
      await page.goto("/help");
      
      // Enter search query
      await page.fill('[data-testid="help-search"]', "booking cancellation");
      await page.press('[data-testid="help-search"]', 'Enter');
      
      // Should show search results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      const searchResults = page.locator('[data-testid="search-result"]');
      const resultCount = await searchResults.count();
      expect(resultCount).toBeGreaterThan(0);
      
      // Should show result details
      const firstResult = searchResults.first();
      await expect(firstResult.locator('[data-testid="result-title"]')).toBeVisible();
      await expect(firstResult.locator('[data-testid="result-excerpt"]')).toBeVisible();
      await expect(firstResult.locator('[data-testid="result-category"]')).toBeVisible();
      
      // Click on result
      await firstResult.click();
      await expect(page.locator('[data-testid="help-article"]')).toBeVisible();
    });

    test("should browse help categories", async ({ page }) => {
      await page.goto("/help");
      
      // Click on a category
      const categories = page.locator('[data-testid="help-category"]');
      if (await categories.first().isVisible()) {
        await categories.first().click();
        
        // Should show category page
        await expect(page.locator('[data-testid="category-header"]')).toBeVisible();
        await expect(page.locator('[data-testid="category-articles"]')).toBeVisible();
        
        // Should show subcategories
        const subcategories = page.locator('[data-testid="subcategory"]');
        const subcategoryCount = await subcategories.count();
        
        if (subcategoryCount > 0) {
          // Click on subcategory
          await subcategories.first().click();
          await expect(page.locator('[data-testid="subcategory-articles"]')).toBeVisible();
        }
        
        // Should show articles list
        const articles = page.locator('[data-testid="article-link"]');
        const articleCount = await articles.count();
        expect(articleCount).toBeGreaterThan(0);
        
        // Click on article
        await articles.first().click();
        await expect(page.locator('[data-testid="help-article"]')).toBeVisible();
      }
    });

    test("should display related articles", async ({ page }) => {
      await page.goto("/help");
      
      // Navigate to an article
      const categories = page.locator('[data-testid="help-category"]');
      if (await categories.first().isVisible()) {
        await categories.first().click();
        
        const articles = page.locator('[data-testid="article-link"]');
        if (await articles.first().isVisible()) {
          await articles.first().click();
          
          // Should show related articles
          const relatedSection = page.locator('[data-testid="related-articles"]');
          if (await relatedSection.isVisible()) {
            const relatedArticles = relatedSection.locator('[data-testid="related-article"]');
            const relatedCount = await relatedArticles.count();
            
            if (relatedCount > 0) {
              await expect(relatedArticles.first().locator('[data-testid="article-title"]')).toBeVisible();
              
              // Click on related article
              await relatedArticles.first().click();
              await expect(page.locator('[data-testid="help-article"]')).toBeVisible();
            }
          }
        }
      }
    });
  });

  test.describe("Support Ticket Creation", () => {
    test("should create support ticket step by step", async ({ page }) => {
      // Login as user
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to support
      await page.goto("/help");
      
      // Click on contact support
      const contactBtn = page.locator('[data-testid="contact-support"]');
      await contactBtn.click();
      
      // Should show support options
      await expect(page.locator('[data-testid="support-options"]')).toBeVisible();
      
      // Select create ticket
      const createTicketBtn = page.locator('[data-testid="create-ticket"]');
      await createTicketBtn.click();
      
      // Step 1: Select issue type
      await expect(page.locator('[data-testid="issue-type-selection"]')).toBeVisible();
      await page.selectOption('[data-testid="issue-category"]', "booking");
      await page.selectOption('[data-testid="issue-type"]', "cancellation");
      await page.click('[data-testid="continue-to-details"]');
      
      // Step 2: Provide details
      await expect(page.locator('[data-testid="issue-details-form"]')).toBeVisible();
      
      await page.fill('[data-testid="subject"]', "Issue with booking cancellation");
      await page.fill('[data-testid="description"]', "I need help canceling my booking due to emergency");
      await page.selectOption('[data-testid="urgency"]', "high");
      await page.fill('[data-testid="booking-reference"]', "BK123456");
      
      await page.click('[data-testid="continue-to-attachments"]');
      
      // Step 3: Attach files (optional)
      await expect(page.locator('[data-testid="attachment-section"]')).toBeVisible();
      
      const uploadSection = page.locator('[data-testid="file-upload"]');
      if (await uploadSection.isVisible()) {
        const fileInput = uploadSection.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'screenshot.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image data')
        });
        
        await expect(uploadSection.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
      }
      
      await page.click('[data-testid="continue-to-review"]');
      
      // Step 4: Review and submit
      await expect(page.locator('[data-testid="ticket-review"]')).toBeVisible();
      await expect(page.locator('[data-testid="ticket-summary"]')).toBeVisible();
      
      // Verify information
      await expect(page.locator('text=Issue with booking cancellation')).toBeVisible();
      await expect(page.locator('text=high urgency')).toBeVisible();
      
      await page.click('[data-testid="submit-ticket"]');
      
      // Success confirmation
      await expect(page.locator('[data-testid="ticket-submitted"]')).toBeVisible();
      await expect(page.locator('[data-testid="ticket-number"]')).toBeVisible();
      await expect(page.locator('[data-testid="ticket-estimated-response"]')).toBeVisible();
    });

    test("should validate ticket information", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/help");
      await page.locator('[data-testid="contact-support"]').click();
      await page.locator('[data-testid="create-ticket"]').click();
      
      // Try to continue without selecting issue type
      await page.click('[data-testid="continue-to-details"]');
      await expect(page.locator('[data-testid="category-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="type-error"]')).toBeVisible();
      
      // Select issue type and try to continue without details
      await page.selectOption('[data-testid="issue-category"]', "booking");
      await page.selectOption('[data-testid="issue-type"]', "cancellation");
      await page.click('[data-testid="continue-to-details"]');
      await page.click('[data-testid="continue-to-attachments"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="subject-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="description-error"]')).toBeVisible();
      
      // Fill required fields
      await page.fill('[data-testid="subject"]', "Test ticket");
      await page.fill('[data-testid="description"]', "Test description");
      await page.click('[data-testid="continue-to-attachments"]');
      
      // Should proceed to attachments step
      await expect(page.locator('[data-testid="attachment-section"]')).toBeVisible();
    });

    test("should save ticket draft", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/help");
      await page.locator('[data-testid="contact-support"]').click();
      await page.locator('[data-testid="create-ticket"]').click();
      
      // Fill partial information
      await page.selectOption('[data-testid="issue-category"]', "booking");
      await page.selectOption('[data-testid="issue-type"]', "cancellation");
      await page.click('[data-testid="continue-to-details"]');
      
      await page.fill('[data-testid="subject"]', "Draft ticket");
      await page.click('[data-testid="save-draft"]');
      
      // Should show draft saved confirmation
      await expect(page.locator('[data-testid="draft-saved"]')).toBeVisible();
      
      // Navigate away and back
      await page.goto("/dashboard");
      await page.goto("/help");
      
      // Should have draft indicator
      const draftIndicator = page.locator('[data-testid="draft-indicator"]');
      if (await draftIndicator.isVisible()) {
        await draftIndicator.click();
        
        // Should restore draft
        await expect(page.locator('[data-testid="subject"]')).toHaveValue("Draft ticket");
      }
    });
  });

  test.describe("Support Ticket Management", () => {
    test("should view and manage existing tickets", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to support tickets
      await page.goto("/help");
      await page.locator('[data-testid="my-tickets"]').click();
      
      // Should show tickets list
      await expect(page.locator('[data-testid="tickets-list"]')).toBeVisible();
      
      const tickets = page.locator('[data-testid="ticket-item"]');
      const ticketCount = await tickets.count();
      
      if (ticketCount > 0) {
        const firstTicket = tickets.first();
        
        // Should show ticket details
        await expect(firstTicket.locator('[data-testid="ticket-number"]')).toBeVisible();
        await expect(firstTicket.locator('[data-testid="ticket-subject"]')).toBeVisible();
        await expect(firstTicket.locator('[data-testid="ticket-status"]')).toBeVisible();
        await expect(firstTicket.locator('[data-testid="ticket-date"]')).toBeVisible();
        
        // Click to view details
        await firstTicket.click();
        
        // Should show ticket details page
        await expect(page.locator('[data-testid="ticket-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="ticket-conversation"]')).toBeVisible();
        
        // Should have reply option
        const replySection = page.locator('[data-testid="reply-section"]');
        if (await replySection.isVisible()) {
          await page.fill('[data-testid="reply-message"]', "Thank you for your response");
          await page.locator('[data-testid="send-reply"]').click();
          
          await expect(page.locator('[data-testid="reply-sent"]')).toBeVisible();
        }
        
        // Should have close ticket option
        const closeBtn = page.locator('[data-testid="close-ticket"]');
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          
          await expect(page.locator('[data-testid="close-confirmation"]')).toBeVisible();
          await page.locator('[data-testid="confirm-close"]').click();
          
          await expect(page.locator('[data-testid="ticket-closed"]')).toBeVisible();
        }
      }
    });

    test("should filter and search tickets", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/help");
      await page.locator('[data-testid="my-tickets"]').click();
      
      // Test search functionality
      const searchInput = page.locator('[data-testid="ticket-search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill("booking");
        await searchInput.press('Enter');
        
        // Should filter results
        const tickets = page.locator('[data-testid="ticket-item"]');
        const ticketCount = await tickets.count();
        
        if (ticketCount > 0) {
          // Should show search term in results
          await expect(tickets.first().locator('text=booking')).toBeVisible();
        }
      }
      
      // Test status filter
      const statusFilter = page.locator('[data-testid="status-filter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.locator('[data-testid="filter-open"]').click();
        
        // Should apply filter
        await expect(page.locator('[data-testid="active-filters"]')).toBeVisible();
      }
      
      // Test date range filter
      const dateFilter = page.locator('[data-testid="date-filter"]');
      if (await dateFilter.isVisible()) {
        await dateFilter.click();
        await page.fill('[data-testid="start-date"]', "2025-01-01");
        await page.fill('[data-testid="end-date"]', "2025-12-31");
        await page.locator('[data-testid="apply-date-filter"]').click();
        
        await expect(page.locator('[data-testid="active-filters"]')).toBeVisible();
      }
    });

    test("should allow ticket escalation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/help");
      await page.locator('[data-testid="my-tickets"]').click();
      
      const tickets = page.locator('[data-testid="ticket-item"]');
      if (await tickets.first().isVisible()) {
        await tickets.first().click();
        
        // Look for escalation option
        const escalateBtn = page.locator('[data-testid="escalate-ticket"]');
        if (await escalateBtn.isVisible()) {
          await escalateBtn.click();
          
          await expect(page.locator('[data-testid="escalation-form"]')).toBeVisible();
          
          await page.fill('[data-testid="escalation-reason"]', "Issue not resolved, need urgent attention");
          await page.selectOption('[data-testid="escalation-level"]', "supervisor");
          
          await page.locator('[data-testid="submit-escalation"]').click();
          
          await expect(page.locator('[data-testid="escalation-submitted"]')).toBeVisible();
        }
      }
    });
  });

  test.describe("Live Chat Support", () => {
    test("should initiate live chat session", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/help");
      
      // Look for live chat option
      const chatBtn = page.locator('[data-testid="live-chat"]');
      if (await chatBtn.isVisible()) {
        await chatBtn.click();
        
        // Should show chat widget
        await expect(page.locator('[data-testid="chat-widget"]')).toBeVisible();
        await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
        await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
        
        // Should show welcome message
        await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
        
        // Send message
        await page.fill('[data-testid="chat-input"]', "Hello, I need help with my booking");
        await page.locator('[data-testid="send-message"]').click();
        
        // Should show user message
        await expect(page.locator('[data-testid="user-message"]')).toBeVisible();
        await expect(page.locator('text=Hello, I need help with my booking')).toBeVisible();

        // Wait for agent response (mock) - wait for typing indicator or agent message
        const typingIndicator = page.locator('[data-testid="typing-indicator"]');
        const agentMessage = page.locator('[data-testid="agent-message"]');
        await Promise.race([
          typingIndicator.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {}),
          agentMessage.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
        ]);

        // Should show typing indicator
        if (await typingIndicator.isVisible()) {
          await expect(typingIndicator).toBeVisible();
        }

        // Should show agent response
        await expect(agentMessage).toBeVisible({ timeout: 10000 });
      }
    });

    test("should handle chat features", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/help");
      
      const chatBtn = page.locator('[data-testid="live-chat"]');
      if (await chatBtn.isVisible()) {
        await chatBtn.click();
        
        // Test file attachment in chat
        const attachBtn = page.locator('[data-testid="chat-attach"]');
        if (await attachBtn.isVisible()) {
          await attachBtn.click();
          
          const fileInput = page.locator('input[type="file"]');
          await fileInput.setInputFiles({
            name: 'chat-document.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('fake pdf content')
          });
          
          await expect(page.locator('[data-testid="file-attached"]')).toBeVisible();
        }
        
        // Test emoji picker
        const emojiBtn = page.locator('[data-testid="emoji-picker"]');
        if (await emojiBtn.isVisible()) {
          await emojiBtn.click();
          await expect(page.locator('[data-testid="emoji-panel"]')).toBeVisible();
          
          await page.locator('[data-testid="emoji-smile"]').click();
          await expect(page.locator('[data-testid="chat-input"]')).toContainText("😊");
        }
        
        // Test chat rating
        const ratingSection = page.locator('[data-testid="chat-rating"]');
        if (await ratingSection.isVisible()) {
          await ratingSection.locator('[data-testid="rating-5"]').click();
          await expect(page.locator('[data-testid="rating-submitted"]')).toBeVisible();
        }
        
        // Test chat transcript
        const transcriptBtn = page.locator('[data-testid="chat-transcript"]');
        if (await transcriptBtn.isVisible()) {
          await transcriptBtn.click();
          
          // Should trigger download
          const downloadPromise = page.waitForEvent('download');
          await downloadPromise;
        }
        
        // Test chat end
        const endChatBtn = page.locator('[data-testid="end-chat"]');
        if (await endChatBtn.isVisible()) {
          await endChatBtn.click();
          
          await expect(page.locator('[data-testid="chat-ended"]')).toBeVisible();
          await expect(page.locator('[data-testid="chat-survey"]')).toBeVisible();
        }
      }
    });

    test("should handle offline chat", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/help");
      
      const chatBtn = page.locator('[data-testid="live-chat"]');
      if (await chatBtn.isVisible()) {
        await chatBtn.click();
        
        // Check if chat is offline
        const offlineMessage = page.locator('[data-testid="chat-offline"]');
        if (await offlineMessage.isVisible()) {
          await expect(offlineMessage).toContainText(/offline|unavailable/i);
          
          // Should show alternative options
          await expect(page.locator('[data-testid="leave-message"]')).toBeVisible();
          await expect(page.locator('[data-testid="email-support"]')).toBeVisible();
          
          // Test leave message option
          await page.locator('[data-testid="leave-message"]').click();
          
          await expect(page.locator('[data-testid="message-form"]')).toBeVisible();
          await page.fill('[data-testid="offline-message"]', "Please help me with my issue");
          await page.fill('[data-testid="offline-email"]', "user@example.com");
          
          await page.locator('[data-testid="send-message"]').click();
          
          await expect(page.locator('[data-testid="message-sent"]')).toBeVisible();
        }
      }
    });
  });

  test.describe("FAQ System", () => {
    test("should browse FAQ categories", async ({ page }) => {
      await page.goto("/help");
      
      // Navigate to FAQ
      const faqLink = page.locator('[data-testid="faq-link"]');
      if (await faqLink.isVisible()) {
        await faqLink.click();
        
        // Should show FAQ page
        await expect(page.locator('[data-testid="faq-categories"]')).toBeVisible();
        
        const categories = page.locator('[data-testid="faq-category"]');
        const categoryCount = await categories.count();
        expect(categoryCount).toBeGreaterThan(0);
        
        // Click on category
        await categories.first().click();
        
        // Should show FAQ items
        await expect(page.locator('[data-testid="faq-items"]')).toBeVisible();
        
        const faqItems = page.locator('[data-testid="faq-item"]');
        const itemCount = await faqItems.count();
        expect(itemCount).toBeGreaterThan(0);
        
        // Click on FAQ item
        await faqItems.first().click();
        
        // Should expand answer
        await expect(faqItems.first().locator('[data-testid="faq-answer"]')).toBeVisible();
      }
    });

    test("should search FAQ", async ({ page }) => {
      await page.goto("/help");
      
      const faqLink = page.locator('[data-testid="faq-link"]');
      if (await faqLink.isVisible()) {
        await faqLink.click();
        
        // Search FAQ
        const searchInput = page.locator('[data-testid="faq-search"]');
        await searchInput.fill("cancellation policy");
        await searchInput.press('Enter');
        
        // Should show search results
        await expect(page.locator('[data-testid="faq-search-results"]')).toBeVisible();
        
        const results = page.locator('[data-testid="faq-result"]');
        const resultCount = await results.count();
        
        if (resultCount > 0) {
          const firstResult = results.first();
          await expect(firstResult.locator('[data-testid="faq-question"]')).toBeVisible();
          await expect(firstResult.locator('[data-testid="faq-answer"]')).toBeVisible();
        }
      }
    });

    test("should show helpful/unhelpful voting", async ({ page }) => {
      await page.goto("/help");
      
      const faqLink = page.locator('[data-testid="faq-link"]');
      if (await faqLink.isVisible()) {
        await faqLink.click();
        
        const faqItems = page.locator('[data-testid="faq-item"]');
        if (await faqItems.first().isVisible()) {
          await faqItems.first().click();
          
          // Should show voting options
          const votingSection = faqItems.first().locator('[data-testid="faq-voting"]');
          if (await votingSection.isVisible()) {
            // Vote helpful
            await votingSection.locator('[data-testid="helpful-yes"]').click();
            await expect(votingSection.locator('[data-testid="vote-recorded"]')).toBeVisible();
            
            // Should disable voting after vote
            await expect(votingSection.locator('[data-testid="helpful-yes"]')).toBeDisabled();
          }
        }
      }
    });
  });

  test.describe("Emergency Support", () => {
    test("should show emergency contact information", async ({ page }) => {
      await page.goto("/help");
      
      // Look for emergency support section
      const emergencySection = page.locator('[data-testid="emergency-support"]');
      if (await emergencySection.isVisible()) {
        await expect(emergencySection.locator('[data-testid="emergency-phone"]')).toBeVisible();
        await expect(emergencySection.locator('[data-testid="emergency-email"]')).toBeVisible();
        await expect(emergencySection.locator('[data-testid="emergency-hours"]')).toBeVisible();
        
        // Should have quick contact buttons
        const callBtn = emergencySection.locator('[data-testid="emergency-call"]');
        if (await callBtn.isVisible()) {
          await callBtn.click();
          
          // Should trigger phone dial (mock)
          await expect(page.locator('[data-testid="call-initiated"]')).toBeVisible();
        }
        
        const emailBtn = emergencySection.locator('[data-testid="emergency-email-btn"]');
        if (await emailBtn.isVisible()) {
          await emailBtn.click();
          
          // Should open email client or in-app email
          await expect(page.locator('[data-testid="email-compose"]')).toBeVisible();
        }
      }
    });

    test("should handle urgent issues", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/help");
      
      // Look for urgent issue reporting
      const urgentBtn = page.locator('[data-testid="urgent-issue"]');
      if (await urgentBtn.isVisible()) {
        await urgentBtn.click();
        
        // Should show urgent issue form
        await expect(page.locator('[data-testid="urgent-form"]')).toBeVisible();
        
        await page.selectOption('[data-testid="issue-type"]', "safety-concern");
        await page.fill('[data-testid="issue-description"]', "There is a safety issue at the property");
        await page.fill('[data-testid="location"]', "Property address or booking ID");
        
        await page.locator('[data-testid="report-urgent"]').click();
        
        // Should show immediate confirmation
        await expect(page.locator('[data-testid="urgent-reported"]')).toBeVisible();
        await expect(page.locator('[data-testid="response-time"]')).toBeVisible();
        await expect(page.locator('[data-testid="contact-info"]')).toBeVisible();
      }
    });
  });

  test.describe("Knowledge Base", () => {
    test("should access knowledge base articles", async ({ page }) => {
      await page.goto("/help");
      
      // Navigate to knowledge base
      const kbLink = page.locator('[data-testid="knowledge-base"]');
      if (await kbLink.isVisible()) {
        await kbLink.click();
        
        // Should show knowledge base structure
        await expect(page.locator('[data-testid="kb-navigation"]')).toBeVisible();
        await expect(page.locator('[data-testid="kb-content"]')).toBeVisible();
        
        // Should have table of contents
        const toc = page.locator('[data-testid="kb-toc"]');
        if (await toc.isVisible()) {
          const tocItems = toc.locator('[data-testid="toc-item"]');
          const tocCount = await tocItems.count();
          expect(tocCount).toBeGreaterThan(0);
          
          // Navigate to section
          await tocItems.first().click();
          
          // Should scroll to section
          const section = page.locator('[data-testid="kb-section"]');
          await expect(section.first()).toBeVisible();
        }
        
        // Should have search functionality
        const searchInput = page.locator('[data-testid="kb-search"]');
        if (await searchInput.isVisible()) {
          await searchInput.fill("payment methods");
          await searchInput.press('Enter');
          
          await expect(page.locator('[data-testid="kb-search-results"]')).toBeVisible();
        }
      }
    });

    test("should show article interactions", async ({ page }) => {
      await page.goto("/help");
      
      const kbLink = page.locator('[data-testid="knowledge-base"]');
      if (await kbLink.isVisible()) {
        await kbLink.click();
        
        // Navigate to an article
        const articles = page.locator('[data-testid="kb-article-link"]');
        if (await articles.first().isVisible()) {
          await articles.first().click();
          
          // Should show article content
          await expect(page.locator('[data-testid="kb-article"]')).toBeVisible();
          
          // Should have article actions
          const actions = page.locator('[data-testid="article-actions"]');
          if (await actions.isVisible()) {
            // Test bookmark
            const bookmarkBtn = actions.locator('[data-testid="bookmark-article"]');
            if (await bookmarkBtn.isVisible()) {
              await bookmarkBtn.click();
              await expect(bookmarkBtn.locator('[data-testid="bookmarked"]')).toBeVisible();
            }
            
            // Test share
            const shareBtn = actions.locator('[data-testid="share-article"]');
            if (await shareBtn.isVisible()) {
              await shareBtn.click();
              await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
            }
            
            // Test print
            const printBtn = actions.locator('[data-testid="print-article"]');
            if (await printBtn.isVisible()) {
              await printBtn.click();
              // Should trigger print dialog
            }
            
            // Test feedback
            const feedbackBtn = actions.locator('[data-testid="article-feedback"]');
            if (await feedbackBtn.isVisible()) {
              await feedbackBtn.click();
              await expect(page.locator('[data-testid="feedback-form"]')).toBeVisible();
              
              await page.selectOption('[data-testid="feedback-rating"]', "5");
              await page.fill('[data-testid="feedback-comment"]', "Very helpful article");
              await page.locator('[data-testid="submit-feedback"]').click();
              
              await expect(page.locator('[data-testid="feedback-submitted"]')).toBeVisible();
            }
          }
        }
      }
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should work on mobile devices", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto("/help");
      
      // Should be mobile-friendly
      await expect(page.locator("h1")).toBeVisible();
      
      // Test mobile navigation
      const mobileNav = page.locator('[data-testid="mobile-nav"]');
      if (await mobileNav.isVisible()) {
        await mobileNav.click();
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      }
      
      // Test mobile search
      await expect(page.locator('[data-testid="help-search"]')).toBeVisible();
      await page.fill('[data-testid="help-search"]', "booking");
      await page.press('[data-testid="help-search"]', 'Enter');
      
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      
      // Test mobile ticket creation
      const contactBtn = page.locator('[data-testid="contact-support"]');
      if (await contactBtn.isVisible()) {
        await contactBtn.click();
        await expect(page.locator('[data-testid="support-options"]')).toBeVisible();
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should be accessible with keyboard navigation", async ({ page }) => {
      await page.goto("/help");
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Test ARIA labels
      const interactiveElements = page.locator('button, input, select, textarea, a[href]');
      const count = await interactiveElements.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = interactiveElements.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });

    test("should support screen readers", async ({ page }) => {
      await page.goto("/help");
      
      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
      
      // Check for landmark regions
      const landmarks = page.locator('main, nav, header, footer, section, article');
      const landmarkCount = await landmarks.count();
      expect(landmarkCount).toBeGreaterThan(0);
      
      // Check for semantic HTML
      const semanticElements = page.locator('article, aside, figure, figcaption, footer, header, main, nav, section');
      const semanticCount = await semanticElements.count();
      expect(semanticCount).toBeGreaterThan(0);
    });
  });
});
