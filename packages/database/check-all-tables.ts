import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

config({ path: '../../.env' });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function checkAllTables() {
  console.log('🔍 Comprehensive table check for seed data...\n');

  try {
    // Core tables
    const auditLogs = await prisma.auditLog.count();
    const userPrefs = await prisma.userPreferences.count();
    const sessions = await prisma.session.count();
    const deviceTokens = await prisma.deviceToken.count();
    const identityDocs = await prisma.identityDocument.count();
    const emailTemplates = await prisma.emailTemplate.count();
    
    // Business entities
    const organizations = await prisma.organization.count();
    const orgMembers = await prisma.organizationMember.count();
    const categories = await prisma.category.count();
    const cancellationPolicies = await prisma.cancellationPolicy.count();
    
    // Listings and content
    const listings = await prisma.listing.count();
    const listingContent = await prisma.listingContent.count();
    const availability = await prisma.availability.count();
    
    // Booking workflow
    const bookings = await prisma.booking.count();
    const bookingStateHistory = await prisma.bookingStateHistory.count();
    const payments = await prisma.payment.count();
    const refunds = await prisma.refund.count();
    const depositHolds = await prisma.depositHold.count();
    const payouts = await prisma.payout.count();
    const ledgerEntries = await prisma.ledgerEntry.count();
    
    // User interactions
    const reviews = await prisma.review.count();
    const favorites = await prisma.favoriteListing.count();
    const notifications = await prisma.notification.count();
    
    // Insurance and disputes
    const conditionReports = await prisma.conditionReport.count();
    const insurancePolicies = await prisma.insurancePolicy.count();
    const insuranceClaims = await prisma.insuranceClaim.count();
    
    // Messaging
    const conversations = await prisma.conversation.count();
    const messages = await prisma.message.count();
    const messageReadReceipts = await prisma.messageReadReceipt.count();
    const disputes = await prisma.dispute.count();

    console.log('📊 Complete Seed Data Overview:');
    console.log('\n🔐 Authentication & Security:');
    console.log(`   Audit Logs: ${auditLogs > 0 ? '✅' : '❌'} (${auditLogs})`);
    console.log(`   User Preferences: ${userPrefs > 0 ? '✅' : '❌'} (${userPrefs})`);
    console.log(`   Sessions: ${sessions > 0 ? '✅' : '❌'} (${sessions})`);
    console.log(`   Device Tokens: ${deviceTokens > 0 ? '✅' : '❌'} (${deviceTokens})`);
    console.log(`   Identity Documents: ${identityDocs > 0 ? '✅' : '❌'} (${identityDocs})`);

    console.log('\n📧 Communication:');
    console.log(`   Email Templates: ${emailTemplates > 0 ? '✅' : '❌'} (${emailTemplates})`);
    console.log(`   Notifications: ${notifications > 0 ? '✅' : '❌'} (${notifications})`);

    console.log('\n🏢 Organizations:');
    console.log(`   Organizations: ${organizations > 0 ? '✅' : '❌'} (${organizations})`);
    console.log(`   Organization Members: ${orgMembers > 0 ? '✅' : '❌'} (${orgMembers})`);

    console.log('\n📂 Categories & Policies:');
    console.log(`   Categories: ${categories > 0 ? '✅' : '❌'} (${categories})`);
    console.log(`   Cancellation Policies: ${cancellationPolicies > 0 ? '✅' : '❌'} (${cancellationPolicies})`);

    console.log('\n🏠 Listings & Content:');
    console.log(`   Listings: ${listings > 0 ? '✅' : '❌'} (${listings})`);
    console.log(`   Listing Content (i18n): ${listingContent > 0 ? '✅' : '❌'} (${listingContent})`);
    console.log(`   Availability: ${availability > 0 ? '✅' : '❌'} (${availability})`);

    console.log('\n💰 Booking & Payment Flow:');
    console.log(`   Bookings: ${bookings > 0 ? '✅' : '❌'} (${bookings})`);
    console.log(`   Booking State History: ${bookingStateHistory > 0 ? '✅' : '❌'} (${bookingStateHistory})`);
    console.log(`   Payments: ${payments > 0 ? '✅' : '❌'} (${payments})`);
    console.log(`   Refunds: ${refunds > 0 ? '✅' : '❌'} (${refunds})`);
    console.log(`   Deposit Holds: ${depositHolds > 0 ? '✅' : '❌'} (${depositHolds})`);
    console.log(`   Payouts: ${payouts > 0 ? '✅' : '❌'} (${payouts})`);
    console.log(`   Ledger Entries: ${ledgerEntries > 0 ? '✅' : '❌'} (${ledgerEntries})`);

    console.log('\n⭐ User Interactions:');
    console.log(`   Reviews: ${reviews > 0 ? '✅' : '❌'} (${reviews})`);
    console.log(`   Favorites: ${favorites > 0 ? '✅' : '❌'} (${favorites})`);

    console.log('\n🛡️ Insurance & Disputes:');
    console.log(`   Condition Reports: ${conditionReports > 0 ? '✅' : '❌'} (${conditionReports})`);
    console.log(`   Insurance Policies: ${insurancePolicies > 0 ? '✅' : '❌'} (${insurancePolicies})`);
    console.log(`   Insurance Claims: ${insuranceClaims > 0 ? '✅' : '❌'} (${insuranceClaims})`);

    console.log('\n💬 Messaging System:');
    console.log(`   Conversations: ${conversations > 0 ? '✅' : '❌'} (${conversations})`);
    console.log(`   Messages: ${messages > 0 ? '✅' : '❌'} (${messages})`);
    console.log(`   Message Read Receipts: ${messageReadReceipts > 0 ? '✅' : '❌'} (${messageReadReceipts})`);
    console.log(`   Disputes: ${disputes > 0 ? '✅' : '❌'} (${disputes})`);

    // Summary
    const totalTables = 29;
    const populatedTables = [
      auditLogs, userPrefs, sessions, deviceTokens, identityDocs, emailTemplates,
      organizations, orgMembers, categories, cancellationPolicies, listings,
      listingContent, availability, bookings, bookingStateHistory, payments,
      refunds, depositHolds, payouts, ledgerEntries, reviews, favorites,
      notifications, conditionReports, insurancePolicies, insuranceClaims,
      conversations, messages, messageReadReceipts, disputes
    ].filter(count => count > 0).length;

    console.log('\n📈 Summary:');
    console.log(`   Tables Populated: ${populatedTables}/${totalTables}`);
    console.log(`   Coverage: ${Math.round((populatedTables / totalTables) * 100)}%`);

    if (populatedTables === totalTables) {
      console.log('🎉 Perfect! All tables have seed data.');
    } else {
      console.log('⚠️  Some tables may need additional seed data.');
    }

  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllTables();
