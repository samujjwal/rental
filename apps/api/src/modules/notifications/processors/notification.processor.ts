import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NotificationsService, SendNotificationDto } from '../services/notifications.service';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private notificationsService: NotificationsService) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing notification job ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`Notification job ${job.id} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Notification job ${job.id} failed: ${error.message}`, error.stack);
  }

  @Process('send')
  async handleSendNotification(job: Job<SendNotificationDto>) {
    try {
      await this.notificationsService.sendNotification(job.data);
      this.logger.log(`Notification sent to user ${job.data.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
      throw error;
    }
  }

  @Process('send-batch')
  async handleBatchNotifications(job: Job<{ notifications: SendNotificationDto[] }>) {
    const { notifications } = job.data;

    try {
      const results = await Promise.allSettled(
        notifications.map((notification) =>
          this.notificationsService.sendNotification(notification),
        ),
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      this.logger.log(
        `Batch notification job completed: ${successful} successful, ${failed} failed`,
      );

      return { successful, failed };
    } catch (error) {
      this.logger.error(`Batch notification job failed: ${error.message}`);
      throw error;
    }
  }

  @Process('scheduled')
  async handleScheduledNotification(job: Job<SendNotificationDto>) {
    try {
      await this.notificationsService.sendNotification(job.data);
      this.logger.log(`Scheduled notification sent to user ${job.data.userId}`);
    } catch (error) {
      this.logger.error(`Failed to send scheduled notification: ${error.message}`);
      throw error;
    }
  }
}
