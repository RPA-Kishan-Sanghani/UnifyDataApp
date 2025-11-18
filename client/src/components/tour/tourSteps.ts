import { Step } from 'react-joyride';

export const tourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to UnifyData AI! Let me show you around the key features of the platform.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-testid="link-application-config"]',
    content: 'Start here to configure your database connections and pipeline settings.',
    placement: 'right',
  },
  {
    target: '[data-testid="link-data-dictionary"]',
    content: 'The Data Dictionary helps you document and manage your data schemas across all layers.',
    placement: 'right',
  },
  {
    target: '#chat-button',
    content: 'Chat with your data using AI! Ask questions in natural language and get instant insights with visualizations.',
    placement: 'left',
    disableBeacon: true,
  },
  {
    target: '[data-testid="link-custom-dashboard"]',
    content: 'Pin your favorite charts here to create a personalized dashboard for quick access to key metrics.',
    placement: 'right',
  },
  {
    target: 'body',
    content: 'That\'s it! You\'re all set to start exploring UnifyData AI. You can restart this tour anytime from the Help menu.',
    placement: 'center',
  },
];
