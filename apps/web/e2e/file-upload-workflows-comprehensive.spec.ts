import { test, expect } from "@playwright/test";
import { ensureSeedData } from "./helpers/seed-data";

/**
 * File Upload Workflows E2E Tests
 * 
 * Tests comprehensive file upload functionality:
 * - Profile photo uploads
 * - Listing image galleries
 * - Document uploads (ID, insurance, etc.)
 * - Bulk file operations
 * - File validation and error handling
 * - Upload progress and cancellation
 */

test.describe("File Upload Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureSeedData(page);
  });

  test.describe("Profile Photo Upload", () => {
    test("should upload and crop profile photo", async ({ page }) => {
      // Login as user
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to profile settings
      await page.goto("/settings/profile");
      
      // Should show profile photo section
      const profilePhotoSection = page.locator('[data-testid="profile-photo"]');
      await expect(profilePhotoSection).toBeVisible();
      
      // Click upload button
      const uploadBtn = profilePhotoSection.locator('[data-testid="upload-photo"]');
      await uploadBtn.click();
      
      // Should open file selector
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'profile-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image data')
      });
      
      // Should show upload progress
      await expect(profilePhotoSection.locator('[data-testid="upload-progress"]')).toBeVisible();
      await expect(profilePhotoSection.locator('[data-testid="progress-bar"]')).toBeVisible();
      
      // Should show crop interface
      await expect(page.locator('[data-testid="crop-modal"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="crop-canvas"]')).toBeVisible();
      await expect(page.locator('[data-testid="crop-controls"]')).toBeVisible();
      
      // Test crop controls
      const cropHandle = page.locator('[data-testid="crop-handle"]');
      if (await cropHandle.isVisible()) {
        await cropHandle.dragTo(page.locator('[data-testid="crop-area"]'), { targetPosition: { x: 100, y: 100 } });
      }
      
      // Confirm crop
      await page.locator('[data-testid="confirm-crop"]').click();
      
      // Should show cropped preview
      await expect(profilePhotoSection.locator('[data-testid="photo-preview"]')).toBeVisible();
      await expect(profilePhotoSection.locator('[data-testid="change-photo"]')).toBeVisible();
      
      // Save profile
      await page.click('[data-testid="save-profile"]');
      await expect(page.locator('[data-testid="profile-saved"]')).toBeVisible();
    });

    test("should handle profile photo validation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/profile");
      
      const profilePhotoSection = page.locator('[data-testid="profile-photo"]');
      const uploadBtn = profilePhotoSection.locator('[data-testid="upload-photo"]');
      await uploadBtn.click();
      
      // Try to upload invalid file type
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('fake pdf content')
      });
      
      // Should show error message
      await expect(profilePhotoSection.locator('[data-testid="upload-error"]')).toBeVisible();
      await expect(profilePhotoSection.locator('text=/file type not supported/i')).toBeVisible();
      
      // Try to upload oversized image
      await fileInput.setInputFiles({
        name: 'large-image.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.alloc(10 * 1024 * 1024) // 10MB
      });
      
      await expect(profilePhotoSection.locator('[data-testid="upload-error"]')).toBeVisible();
      await expect(profilePhotoSection.locator('text=/file too large/i')).toBeVisible();
    });

    test("should allow photo replacement", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/profile");
      
      const profilePhotoSection = page.locator('[data-testid="profile-photo"]');
      
      // If existing photo, should show change option
      const changeBtn = profilePhotoSection.locator('[data-testid="change-photo"]');
      if (await changeBtn.isVisible()) {
        await changeBtn.click();
        
        // Should show file selector
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'new-photo.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image data')
        });
        
        await expect(page.locator('[data-testid="crop-modal"]')).toBeVisible({ timeout: 10000 });
        await page.locator('[data-testid="confirm-crop"]').click();
        
        await expect(profilePhotoSection.locator('[data-testid="photo-updated"]')).toBeVisible();
      }
    });

    test("should remove profile photo", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/profile");
      
      const profilePhotoSection = page.locator('[data-testid="profile-photo"]');
      
      // If existing photo, should show remove option
      const removeBtn = profilePhotoSection.locator('[data-testid="remove-photo"]');
      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        
        // Should show confirmation
        await expect(page.locator('[data-testid="remove-confirmation"]')).toBeVisible();
        await page.locator('[data-testid="confirm-remove"]').click();
        
        await expect(profilePhotoSection.locator('[data-testid="photo-removed"]')).toBeVisible();
        await expect(profilePhotoSection.locator('[data-testid="upload-photo"]')).toBeVisible();
      }
    });
  });

  test.describe("Listing Image Gallery", () => {
    test("should upload listing photos step by step", async ({ page }) => {
      // Login as owner
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to listing creation
      await page.goto("/listings/new");
      
      // Should show photo upload section
      const photoSection = page.locator('[data-testid="listing-photos"]');
      await expect(photoSection).toBeVisible();
      
      // Click add photos button
      const addPhotosBtn = photoSection.locator('[data-testid="add-photos"]');
      await addPhotosBtn.click();
      
      // Should open file selector (multiple files)
      const fileInput = page.locator('input[type="file"][multiple]');
      await fileInput.setInputFiles([
        {
          name: 'listing-photo-1.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image data 1')
        },
        {
          name: 'listing-photo-2.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image data 2')
        },
        {
          name: 'listing-photo-3.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake image data 3')
        }
      ]);
      
      // Should show upload progress for each file
      await expect(photoSection.locator('[data-testid="upload-progress"]')).toBeVisible();
      const progressBars = photoSection.locator('[data-testid="file-progress"]');
      const progressCount = await progressBars.count();
      expect(progressCount).toBe(3);
      
      // Wait for uploads to complete
      await expect(photoSection.locator('[data-testid="upload-complete"]')).toBeVisible({ timeout: 15000 });
      
      // Should show photo gallery
      await expect(photoSection.locator('[data-testid="photo-gallery"]')).toBeVisible();
      const photoThumbnails = photoSection.locator('[data-testid="photo-thumbnail"]');
      const thumbnailCount = await photoThumbnails.count();
      expect(thumbnailCount).toBe(3);
      
      // Should allow reordering
      const firstThumbnail = photoThumbnails.first();
      const secondThumbnail = photoThumbnails.nth(1);
      
      if (await firstThumbnail.isVisible() && await secondThumbnail.isVisible()) {
        await firstThumbnail.dragTo(secondThumbnail);
        
        // Should show reordering indicator
        await expect(photoSection.locator('[data-testid="reorder-indicator"]')).toBeVisible();
      }
      
      // Should allow setting cover photo
      const setCoverBtn = photoThumbnails.nth(1).locator('[data-testid="set-cover"]');
      if (await setCoverBtn.isVisible()) {
        await setCoverBtn.click();
        
        await expect(photoThumbnails.nth(1).locator('[data-testid="cover-badge"]')).toBeVisible();
      }
      
      // Should allow photo editing
      const editBtn = photoThumbnails.first().locator('[data-testid="edit-photo"]');
      if (await editBtn.isVisible()) {
        await editBtn.click();
        
        await expect(page.locator('[data-testid="photo-editor"]')).toBeVisible();
        await expect(page.locator('[data-testid="edit-crop"]')).toBeVisible();
        await expect(page.locator('[data-testid="edit-filters"]')).toBeVisible();
        await expect(page.locator('[data-testid="edit-brightness"]')).toBeVisible();
        
        // Test crop
        await page.locator('[data-testid="edit-crop"]').click();
        await expect(page.locator('[data-testid="crop-canvas"]')).toBeVisible();
        await page.locator('[data-testid="confirm-crop"]').click();
        
        // Test filters
        await page.locator('[data-testid="edit-filters"]').click();
        await page.locator('[data-testid="filter-vintage"]').click();
        await page.locator('[data-testid="apply-filter"]').click();
        
        // Save edits
        await page.locator('[data-testid="save-edits"]').click();
        await expect(photoSection.locator('[data-testid="photo-updated"]')).toBeVisible();
      }
      
      // Should allow photo deletion
      const deleteBtn = photoThumbnails.last().locator('[data-testid="delete-photo"]');
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        
        await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
        await page.locator('[data-testid="confirm-delete"]').click();
        
        await expect(photoSection.locator('[data-testid="photo-deleted"]')).toBeVisible();
      }
    });

    test("should handle listing photo validation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/listings/new");
      
      const photoSection = page.locator('[data-testid="listing-photos"]');
      const addPhotosBtn = photoSection.locator('[data-testid="add-photos"]');
      await addPhotosBtn.click();
      
      const fileInput = page.locator('input[type="file"][multiple]');
      
      // Try to upload non-image files
      await fileInput.setInputFiles([
        {
          name: 'document.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('fake pdf content')
        },
        {
          name: 'spreadsheet.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('fake spreadsheet content')
        }
      ]);
      
      // Should show validation errors
      await expect(photoSection.locator('[data-testid="validation-errors"]')).toBeVisible();
      await expect(photoSection.locator('text=/Only image files are allowed/i')).toBeVisible();
      
      // Try to upload oversized images
      await fileInput.setInputFiles([
        {
          name: 'huge-image.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.alloc(15 * 1024 * 1024) // 15MB
        }
      ]);
      
      await expect(photoSection.locator('[data-testid="upload-error"]')).toBeVisible();
      await expect(photoSection.locator('text=/File size exceeds limit/i')).toBeVisible();
      
      // Try to upload too many photos
      const manyFiles = Array.from({ length: 25 }, (_, i) => ({
        name: `photo-${i + 1}.jpg`,
        mimeType: 'image/jpeg',
        buffer: Buffer.from(`fake image data ${i + 1}`)
      }));
      
      await fileInput.setInputFiles(manyFiles);
      
      await expect(photoSection.locator('[data-testid="too-many-files"]')).toBeVisible();
      await expect(photoSection.locator('text=/Maximum.*photos allowed/i')).toBeVisible();
    });

    test("should show upload progress and allow cancellation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/listings/new");
      
      const photoSection = page.locator('[data-testid="listing-photos"]');
      const addPhotosBtn = photoSection.locator('[data-testid="add-photos"]');
      await addPhotosBtn.click();
      
      // Upload large files to see progress
      const largeFile = {
        name: 'large-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.alloc(5 * 1024 * 1024) // 5MB
      };
      
      const fileInput = page.locator('input[type="file"][multiple]');
      await fileInput.setInputFiles([largeFile]);
      
      // Should show progress bar
      await expect(photoSection.locator('[data-testid="progress-bar"]')).toBeVisible();
      await expect(photoSection.locator('[data-testid="progress-percentage"]')).toBeVisible();
      
      // Should show file name and size
      await expect(photoSection.locator('[data-testid="file-info"]')).toBeVisible();
      await expect(photoSection.locator('text=large-photo.jpg')).toBeVisible();
      await expect(photoSection.locator('text=5.0 MB')).toBeVisible();
      
      // Should allow cancellation
      const cancelBtn = photoSection.locator('[data-testid="cancel-upload"]');
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        
        await expect(page.locator('[data-testid="cancel-confirmation"]')).toBeVisible();
        await page.locator('[data-testid="confirm-cancel"]').click();
        
        await expect(photoSection.locator('[data-testid="upload-cancelled"]')).toBeVisible();
      }
    });
  });

  test.describe("Document Upload", () => {
    test("should upload identity verification documents", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to verification
      await page.goto("/settings/verification");
      
      // Should show document upload section
      const documentSection = page.locator('[data-testid="document-upload"]');
      await expect(documentSection).toBeVisible();
      
      // Upload ID document
      const idUpload = documentSection.locator('[data-testid="id-upload"]');
      await idUpload.locator('[data-testid="upload-button"]').click();
      
      const fileInput = idUpload.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'national-id.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake id image data')
      });
      
      // Should show upload progress
      await expect(idUpload.locator('[data-testid="upload-progress"]')).toBeVisible();
      await expect(idUpload.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
      
      // Should show preview
      await expect(idUpload.locator('[data-testid="document-preview"]')).toBeVisible();
      await expect(idUpload.locator('[data-testid="document-details"]')).toBeVisible();
      
      // Upload selfie
      const selfieUpload = documentSection.locator('[data-testid="selfie-upload"]');
      await selfieUpload.locator('[data-testid="upload-button"]').click();
      
      await selfieUpload.locator('input[type="file"]').setInputFiles({
        name: 'selfie.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake selfie data')
      });
      
      await expect(selfieUpload.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
      
      // Submit verification
      await page.locator('[data-testid="submit-verification"]').click();
      
      await expect(page.locator('[data-testid="verification-submitted"]')).toBeVisible();
      await expect(page.locator('[data-testid="verification-status"]')).toBeVisible();
    });

    test("should upload insurance documents", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      // Navigate to insurance
      await page.goto("/insurance/upload");
      
      // Should show insurance document upload
      const insuranceSection = page.locator('[data-testid="insurance-upload"]');
      await expect(insuranceSection).toBeVisible();
      
      // Upload policy document
      const policyUpload = insuranceSection.locator('[data-testid="policy-upload"]');
      await policyUpload.locator('[data-testid="upload-button"]').click();
      
      const fileInput = policyUpload.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'insurance-policy.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('fake insurance policy content')
      });
      
      await expect(policyUpload.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
      
      // Should show document details
      await expect(policyUpload.locator('[data-testid="document-name"]')).toContainText('insurance-policy.pdf');
      await expect(policyUpload.locator('[data-testid="document-type"]')).toContainText('PDF');
      await expect(policyUpload.locator('[data-testid="document-size"]')).toBeVisible();
      
      // Upload additional documents
      const additionalUpload = insuranceSection.locator('[data-testid="additional-upload"]');
      await additionalUpload.locator('[data-testid="upload-button"]').click();
      
      await additionalUpload.locator('input[type="file"]').setInputFiles([
        {
          name: 'receipt.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake receipt data')
        },
        {
          name: 'medical-report.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('fake medical report content')
        }
      ]);
      
      await expect(additionalUpload.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 15000 });
      
      // Submit documents
      await page.locator('[data-testid="submit-documents"]').click();
      
      await expect(page.locator('[data-testid="documents-submitted"]')).toBeVisible();
    });

    test("should validate document formats and sizes", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/verification");
      
      const documentSection = page.locator('[data-testid="document-upload"]');
      const idUpload = documentSection.locator('[data-testid="id-upload"]');
      await idUpload.locator('[data-testid="upload-button"]').click();
      
      const fileInput = idUpload.locator('input[type="file"]');
      
      // Try unsupported format
      await fileInput.setInputFiles({
        name: 'document.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('plain text content')
      });
      
      await expect(idUpload.locator('[data-testid="format-error"]')).toBeVisible();
      await expect(idUpload.locator('text=/Unsupported file format/i')).toBeVisible();
      
      // Try oversized document
      await fileInput.setInputFiles({
        name: 'large-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(25 * 1024 * 1024) // 25MB
      });
      
      await expect(idUpload.locator('[data-testid="size-error"]')).toBeVisible();
      await expect(idUpload.locator('text=/File too large/i')).toBeVisible();
      
      // Try corrupted file
      await fileInput.setInputFiles({
        name: 'corrupted.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('corrupted data that is not a valid image')
      });
      
      await expect(idUpload.locator('[data-testid="corruption-error"]')).toBeVisible();
      await expect(idUpload.locator('text=/File appears to be corrupted/i')).toBeVisible();
    });

    test("should allow document preview and download", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/insurance/upload");
      
      const insuranceSection = page.locator('[data-testid="insurance-upload"]');
      const policyUpload = insuranceSection.locator('[data-testid="policy-upload"]');
      
      // Upload a document first
      await policyUpload.locator('[data-testid="upload-button"]').click();
      await policyUpload.locator('input[type="file"]').setInputFiles({
        name: 'test-policy.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('fake policy content')
      });
      
      await expect(policyUpload.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 10000 });
      
      // Test preview
      const previewBtn = policyUpload.locator('[data-testid="preview-document"]');
      if (await previewBtn.isVisible()) {
        await previewBtn.click();
        
        await expect(page.locator('[data-testid="preview-modal"]')).toBeVisible();
        await expect(page.locator('[data-testid="document-viewer"]')).toBeVisible();
        
        // Test zoom controls
        await page.locator('[data-testid="zoom-in"]').click();
        await page.locator('[data-testid="zoom-out"]').click();
        await page.locator('[data-testid="zoom-fit"]').click();
        
        // Test pagination
        const nextPageBtn = page.locator('[data-testid="next-page"]');
        if (await nextPageBtn.isVisible()) {
          await nextPageBtn.click();
          await expect(page.locator('[data-testid="page-number"]')).toContainText('2');
        }
        
        await page.locator('[data-testid="close-preview"]').click();
      }
      
      // Test download
      const downloadBtn = policyUpload.locator('[data-testid="download-document"]');
      if (await downloadBtn.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await downloadBtn.click();
        const download = await downloadPromise;
        
        expect(download.suggestedFilename()).toBe('test-policy.pdf');
      }
      
      // Test replace
      const replaceBtn = policyUpload.locator('[data-testid="replace-document"]');
      if (await replaceBtn.isVisible()) {
        await replaceBtn.click();
        
        await expect(page.locator('[data-testid="replace-confirmation"]')).toBeVisible();
        await page.locator('[data-testid="confirm-replace"]').click();
        
        // Should show file selector again
        await expect(policyUpload.locator('input[type="file"]')).toBeVisible();
      }
      
      // Test delete
      const deleteBtn = policyUpload.locator('[data-testid="delete-document"]');
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        
        await expect(page.locator('[data-testid="delete-confirmation"]')).toBeVisible();
        await page.locator('[data-testid="confirm-delete"]').click();
        
        await expect(policyUpload.locator('[data-testid="document-deleted"]')).toBeVisible();
      }
    });
  });

  test.describe("Bulk File Operations", () => {
    test("should handle bulk photo uploads", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "owner@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/listings/new");
      
      const photoSection = page.locator('[data-testid="listing-photos"]');
      const addPhotosBtn = photoSection.locator('[data-testid="add-photos"]');
      await addPhotosBtn.click();
      
      // Create many test files
      const manyFiles = Array.from({ length: 15 }, (_, i) => ({
        name: `listing-photo-${i + 1}.jpg`,
        mimeType: 'image/jpeg',
        buffer: Buffer.from(`fake image data ${i + 1}`)
      }));
      
      const fileInput = page.locator('input[type="file"][multiple]');
      await fileInput.setInputFiles(manyFiles);
      
      // Should show bulk upload interface
      await expect(photoSection.locator('[data-testid="bulk-upload"]')).toBeVisible();
      await expect(photoSection.locator('[data-testid="upload-queue"]')).toBeVisible();
      
      // Should show all files in queue
      const queueItems = photoSection.locator('[data-testid="queue-item"]');
      const queueCount = await queueItems.count();
      expect(queueCount).toBe(15);
      
      // Should show individual progress
      await expect(photoSection.locator('[data-testid="overall-progress"]')).toBeVisible();
      await expect(photoSection.locator('[data-testid="files-remaining"]')).toBeVisible();
      
      // Should allow removing files from queue
      const firstItem = queueItems.first();
      const removeBtn = firstItem.locator('[data-testid="remove-from-queue"]');
      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        
        const newQueueCount = await photoSection.locator('[data-testid="queue-item"]').count();
        expect(newQueueCount).toBe(14);
      }
      
      // Should allow pausing upload
      const pauseBtn = photoSection.locator('[data-testid="pause-upload"]');
      if (await pauseBtn.isVisible()) {
        await pauseBtn.click();
        
        await expect(photoSection.locator('[data-testid="upload-paused"]')).toBeVisible();
        
        // Should allow resuming
        const resumeBtn = photoSection.locator('[data-testid="resume-upload"]');
        await resumeBtn.click();
        
        await expect(photoSection.locator('[data-testid="upload-resumed"]')).toBeVisible();
      }
      
      // Wait for completion
      await expect(photoSection.locator('[data-testid="bulk-complete"]')).toBeVisible({ timeout: 30000 });
      
      // Should show results summary
      await expect(photoSection.locator('[data-testid="upload-summary"]')).toBeVisible();
      await expect(photoSection.locator('[data-testid="successful-uploads"]')).toBeVisible();
      await expect(photoSection.locator('[data-testid="failed-uploads"]')).toBeVisible();
    });

    test("should handle bulk document uploads", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/insurance/upload");
      
      const insuranceSection = page.locator('[data-testid="insurance-upload"]');
      const bulkUploadBtn = insuranceSection.locator('[data-testid="bulk-upload"]');
      if (await bulkUploadBtn.isVisible()) {
        await bulkUploadBtn.click();
        
        // Create mixed document types
        const mixedFiles = [
          {
            name: 'policy-document.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('fake policy content')
          },
          {
            name: 'receipt.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake receipt data')
          },
          {
            name: 'medical-report.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('fake medical report')
          },
          {
            name: 'damage-photo.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake damage photo')
          },
          {
            name: 'invoice.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('fake invoice content')
          }
        ];
        
        const fileInput = page.locator('input[type="file"][multiple]');
        await fileInput.setInputFiles(mixedFiles);
        
        // Should show file categorization
        await expect(page.locator('[data-testid="file-categorization"]')).toBeVisible();
        
        // Should allow category assignment
        const pdfCategory = page.locator('[data-testid="pdf-category"]');
        if (await pdfCategory.isVisible()) {
          await page.selectOption('[data-testid="pdf-category"]', "policy-documents");
        }
        
        const imageCategory = page.locator('[data-testid="image-category"]');
        if (await imageCategory.isVisible()) {
          await page.selectOption('[data-testid="image-category"]', "evidence-photos");
        }
        
        await page.locator('[data-testid="start-bulk-upload"]').click();
        
        await expect(page.locator('[data-testid="bulk-progress"]')).toBeVisible();
        await expect(page.locator('[data-testid="bulk-complete"]')).toBeVisible({ timeout: 20000 });
      }
    });
  });

  test.describe("Upload Error Handling", () => {
    test("should handle network errors during upload", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/profile");
      
      const profilePhotoSection = page.locator('[data-testid="profile-photo"]');
      const uploadBtn = profilePhotoSection.locator('[data-testid="upload-photo"]');
      await uploadBtn.click();
      
      // Mock network failure
      await page.route('**/upload', route => route.abort('failed'));
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'profile-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image data')
      });
      
      // Should show network error
      await expect(profilePhotoSection.locator('[data-testid="network-error"]')).toBeVisible();
      await expect(profilePhotoSection.locator('text=/Network error occurred/i')).toBeVisible();
      
      // Should show retry option
      const retryBtn = profilePhotoSection.locator('[data-testid="retry-upload"]');
      if (await retryBtn.isVisible()) {
        // Remove mock and retry
        await page.unroute('**/upload');
        await retryBtn.click();
        
        await expect(profilePhotoSection.locator('[data-testid="upload-progress"]')).toBeVisible();
      }
    });

    test("should handle server errors gracefully", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/listings/new");
      
      const photoSection = page.locator('[data-testid="listing-photos"]');
      const addPhotosBtn = photoSection.locator('[data-testid="add-photos"]');
      await addPhotosBtn.click();
      
      // Mock server error
      await page.route('**/upload', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });
      
      const fileInput = page.locator('input[type="file"][multiple]');
      await fileInput.setInputFiles([{
        name: 'listing-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image data')
      }]);
      
      // Should show server error
      await expect(photoSection.locator('[data-testid="server-error"]')).toBeVisible();
      await expect(photoSection.locator('text=/Server error occurred/i')).toBeVisible();
      
      // Should show error details
      await expect(photoSection.locator('[data-testid="error-details"]')).toBeVisible();
      await expect(photoSection.locator('text=Internal server error')).toBeVisible();
      
      // Should allow reporting error
      const reportBtn = photoSection.locator('[data-testid="report-error"]');
      if (await reportBtn.isVisible()) {
        await reportBtn.click();
        
        await expect(page.locator('[data-testid="error-report-form"]')).toBeVisible();
        await page.fill('[data-testid="error-description"]', "Upload failed with server error");
        await page.locator('[data-testid="submit-report"]').click();
        
        await expect(page.locator('[data-testid="error-reported"]')).toBeVisible();
      }
    });

    test("should handle file corruption detection", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/verification");
      
      const documentSection = page.locator('[data-testid="document-upload"]');
      const idUpload = documentSection.locator('[data-testid="id-upload"]');
      await idUpload.locator('[data-testid="upload-button"]').click();
      
      // Upload corrupted file
      const fileInput = idUpload.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'corrupted-id.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('this is not a valid image file format')
      });
      
      // Should detect corruption
      await expect(idUpload.locator('[data-testid="corruption-detected"]')).toBeVisible();
      await expect(idUpload.locator('text=/File appears to be corrupted/i')).toBeVisible();
      
      // Should provide suggestions
      await expect(idUpload.locator('[data-testid="corruption-suggestions"]')).toBeVisible();
      await expect(idUpload.locator('text=/Please try re-saving the file/i')).toBeVisible();
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should work on mobile devices", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/profile");
      
      // Should be mobile-friendly
      await expect(page.locator('[data-testid="profile-photo"]')).toBeVisible();
      
      // Test mobile photo upload
      const uploadBtn = page.locator('[data-testid="upload-photo"]');
      if (await uploadBtn.isVisible()) {
        await uploadBtn.click();
        
        // Should show mobile-friendly file selector
        await expect(page.locator('input[type="file"]')).toBeVisible();
        
        // Should show mobile crop interface
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: 'mobile-photo.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake mobile image data')
        });
        
        await expect(page.locator('[data-testid="crop-modal"]')).toBeVisible({ timeout: 10000 });
        
        // Test mobile crop controls
        await expect(page.locator('[data-testid="mobile-crop-controls"]')).toBeVisible();
        await page.locator('[data-testid="confirm-crop"]').click();
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should be accessible with keyboard navigation", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/profile");
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Test ARIA labels
      const interactiveElements = page.locator('button, input[type="file"]');
      const count = await interactiveElements.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = interactiveElements.nth(i);
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });

    test("should support screen readers", async ({ page }) => {
      await page.goto("/auth/login");
      await page.fill('[data-testid="email"]', "user@example.com");
      await page.fill('[data-testid="password"]', "password123");
      await page.click('[data-testid="login-button"]');
      
      await page.goto("/settings/profile");
      
      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
      
      // Check for landmark regions
      const landmarks = page.locator('main, section, article');
      const landmarkCount = await landmarks.count();
      expect(landmarkCount).toBeGreaterThan(0);
      
      // Check for alt text on uploaded images
      const uploadedImages = page.locator('[data-testid="uploaded-image"]');
      const imageCount = await uploadedImages.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = uploadedImages.nth(i);
        const alt = await img.getAttribute('alt');
        expect(alt).toBeTruthy();
      }
    });
  });
});
