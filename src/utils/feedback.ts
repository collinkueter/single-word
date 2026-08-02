import { Linking } from 'react-native';

export interface FeedbackData {
  url: string;
  extractedText: string;
  userComment?: string;
  timestamp: string;
  title?: string;
}

const FEEDBACK_EMAIL = 'hello@collality.com';

export async function submitFeedback(data: FeedbackData): Promise<void> {
  const subject = encodeURIComponent('Single Word Feedback');

  const body = encodeURIComponent(
    [
      data.userComment ? `Comment: ${data.userComment}` : '',
      data.url ? `URL: ${data.url}` : '',
      data.title ? `Title: ${data.title}` : '',
      `Time: ${data.timestamp}`,
      data.extractedText
        ? `\nExtracted text (first 500 chars):\n${data.extractedText.slice(0, 500)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  const mailtoUrl = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
  const canOpen = await Linking.canOpenURL(mailtoUrl);
  if (!canOpen) throw new Error('No email app available');
  await Linking.openURL(mailtoUrl);
}
