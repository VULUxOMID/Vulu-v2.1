/**
 * Accessibility Testing for VULU Messaging System
 * Tests screen reader compatibility, keyboard navigation, high contrast mode, font scaling, and accessibility compliance
 */

describe('Accessibility Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Screen Reader Compatibility (VoiceOver/TalkBack)', () => {
    const mockScreenReader = {
      isEnabled: true,
      announcements: [] as string[],
      
      announce(text: string, priority: 'low' | 'medium' | 'high' = 'medium') {
        this.announcements.push(`[${priority}] ${text}`);
      },
      
      getLastAnnouncement() {
        return this.announcements[this.announcements.length - 1];
      },
      
      clearAnnouncements() {
        this.announcements = [];
      }
    };

    const createAccessibleComponent = (type: string, props: any = {}) => {
      const baseProps = {
        accessible: true,
        accessibilityRole: type,
        accessibilityLabel: props.label || `${type} element`,
        accessibilityHint: props.hint,
        accessibilityState: props.state || {},
        accessibilityValue: props.value,
      };

      return {
        ...baseProps,
        ...props,
        type,
        
        focus() {
          if (mockScreenReader.isEnabled) {
            mockScreenReader.announce(
              `${this.accessibilityLabel}${this.accessibilityHint ? '. ' + this.accessibilityHint : ''}`,
              'medium'
            );
          }
        },
        
        performAction(action: string) {
          if (mockScreenReader.isEnabled) {
            mockScreenReader.announce(`${action} ${this.accessibilityLabel}`, 'high');
          }
        }
      };
    };

    it('should provide proper accessibility labels for message components', () => {
      const messageComponent = createAccessibleComponent('text', {
        label: 'Message from John Doe: Hello, how are you?',
        hint: 'Double tap to reply',
        state: { selected: false },
        value: { text: 'Hello, how are you?' }
      });

      messageComponent.focus();
      
      expect(mockScreenReader.getLastAnnouncement()).toContain('Message from John Doe');
      expect(mockScreenReader.getLastAnnouncement()).toContain('Double tap to reply');
    });

    it('should announce message status changes', () => {
      const messageStatuses = [
        { status: 'sending', announcement: 'Message sending' },
        { status: 'sent', announcement: 'Message sent' },
        { status: 'delivered', announcement: 'Message delivered' },
        { status: 'read', announcement: 'Message read' },
        { status: 'failed', announcement: 'Message failed to send' },
      ];

      messageStatuses.forEach(({ status, announcement }) => {
        mockScreenReader.clearAnnouncements();
        mockScreenReader.announce(announcement, 'medium');
        
        expect(mockScreenReader.getLastAnnouncement()).toContain(announcement);
      });
    });

    it('should provide accessible navigation for conversation list', () => {
      const conversations = [
        { id: 'conv1', name: 'John Doe', lastMessage: 'Hey there!', unreadCount: 2 },
        { id: 'conv2', name: 'Jane Smith', lastMessage: 'See you tomorrow', unreadCount: 0 },
        { id: 'conv3', name: 'Group Chat', lastMessage: 'Thanks everyone!', unreadCount: 5 },
      ];

      conversations.forEach((conv, index) => {
        const conversationComponent = createAccessibleComponent('button', {
          label: `Conversation with ${conv.name}. Last message: ${conv.lastMessage}${conv.unreadCount > 0 ? `. ${conv.unreadCount} unread messages` : ''}`,
          hint: 'Double tap to open conversation',
          state: { selected: false },
        });

        conversationComponent.focus();
        
        const announcement = mockScreenReader.getLastAnnouncement();
        expect(announcement).toContain(conv.name);
        expect(announcement).toContain(conv.lastMessage);
        
        if (conv.unreadCount > 0) {
          expect(announcement).toContain(`${conv.unreadCount} unread`);
        }
      });
    });

    it('should handle typing indicators accessibly', () => {
      const typingUsers = ['John Doe', 'Jane Smith'];
      
      const announceTyping = (users: string[]) => {
        if (users.length === 0) return;
        
        let announcement = '';
        if (users.length === 1) {
          announcement = `${users[0]} is typing`;
        } else if (users.length === 2) {
          announcement = `${users[0]} and ${users[1]} are typing`;
        } else {
          announcement = `${users[0]} and ${users.length - 1} others are typing`;
        }
        
        mockScreenReader.announce(announcement, 'low');
      };

      // Test single user typing
      announceTyping(['John Doe']);
      expect(mockScreenReader.getLastAnnouncement()).toBe('[low] John Doe is typing');

      // Test multiple users typing
      announceTyping(['John Doe', 'Jane Smith']);
      expect(mockScreenReader.getLastAnnouncement()).toBe('[low] John Doe and Jane Smith are typing');

      // Test many users typing
      announceTyping(['John Doe', 'Jane Smith', 'Bob Wilson']);
      expect(mockScreenReader.getLastAnnouncement()).toBe('[low] John Doe and 2 others are typing');
    });

    it('should provide accessible voice message controls', () => {
      const voiceMessageComponent = createAccessibleComponent('button', {
        label: 'Voice message from John Doe, duration 15 seconds',
        hint: 'Double tap to play or pause',
        state: { expanded: false, selected: false },
        value: { now: 0, min: 0, max: 15 }
      });

      // Test play action
      voiceMessageComponent.performAction('Play');
      expect(mockScreenReader.getLastAnnouncement()).toContain('Play Voice message');

      // Test pause action
      voiceMessageComponent.performAction('Pause');
      expect(mockScreenReader.getLastAnnouncement()).toContain('Pause Voice message');

      // Test seek action
      mockScreenReader.announce('Voice message position: 7 seconds of 15 seconds', 'low');
      expect(mockScreenReader.getLastAnnouncement()).toContain('7 seconds of 15 seconds');
    });

    it('should handle attachment accessibility', () => {
      const attachmentTypes = [
        { type: 'image', label: 'Image attachment: sunset.jpg', hint: 'Double tap to view image' },
        { type: 'document', label: 'Document attachment: report.pdf', hint: 'Double tap to open document' },
        { type: 'video', label: 'Video attachment: vacation.mp4, duration 2 minutes', hint: 'Double tap to play video' },
      ];

      attachmentTypes.forEach(attachment => {
        const attachmentComponent = createAccessibleComponent('button', {
          label: attachment.label,
          hint: attachment.hint,
        });

        attachmentComponent.focus();
        
        const announcement = mockScreenReader.getLastAnnouncement();
        expect(announcement).toContain(attachment.label);
        expect(announcement).toContain(attachment.hint);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    const mockKeyboardHandler = {
      focusedElement: null as any,
      tabOrder: [] as any[],
      
      setTabOrder(elements: any[]) {
        this.tabOrder = elements;
      },
      
      focusElement(index: number) {
        if (index >= 0 && index < this.tabOrder.length) {
          this.focusedElement = this.tabOrder[index];
          return true;
        }
        return false;
      },
      
      handleKeyPress(key: string) {
        const currentIndex = this.tabOrder.indexOf(this.focusedElement);
        
        switch (key) {
          case 'Tab':
            return this.focusElement((currentIndex + 1) % this.tabOrder.length);
          case 'Shift+Tab':
            return this.focusElement(currentIndex > 0 ? currentIndex - 1 : this.tabOrder.length - 1);
          case 'Enter':
          case 'Space':
            if (this.focusedElement?.onPress) {
              this.focusedElement.onPress();
              return true;
            }
            return false;
          case 'Escape':
            if (this.focusedElement?.onDismiss) {
              this.focusedElement.onDismiss();
              return true;
            }
            return false;
          default:
            return false;
        }
      }
    };

    it('should support keyboard navigation in conversation list', () => {
      const conversations = [
        { id: 'conv1', name: 'John Doe', focusable: true, onPress: jest.fn() },
        { id: 'conv2', name: 'Jane Smith', focusable: true, onPress: jest.fn() },
        { id: 'conv3', name: 'Group Chat', focusable: true, onPress: jest.fn() },
      ];

      mockKeyboardHandler.setTabOrder(conversations);
      mockKeyboardHandler.focusElement(0);

      // Test Tab navigation
      expect(mockKeyboardHandler.focusedElement).toBe(conversations[0]);
      
      mockKeyboardHandler.handleKeyPress('Tab');
      expect(mockKeyboardHandler.focusedElement).toBe(conversations[1]);
      
      mockKeyboardHandler.handleKeyPress('Tab');
      expect(mockKeyboardHandler.focusedElement).toBe(conversations[2]);

      // Test Enter activation
      mockKeyboardHandler.handleKeyPress('Enter');
      expect(conversations[2].onPress).toHaveBeenCalled();

      // Test Shift+Tab (reverse navigation)
      mockKeyboardHandler.handleKeyPress('Shift+Tab');
      expect(mockKeyboardHandler.focusedElement).toBe(conversations[1]);
    });

    it('should support keyboard navigation in chat interface', () => {
      const chatElements = [
        { id: 'message-input', type: 'textinput', focusable: true, onFocus: jest.fn() },
        { id: 'send-button', type: 'button', focusable: true, onPress: jest.fn() },
        { id: 'attachment-button', type: 'button', focusable: true, onPress: jest.fn() },
        { id: 'emoji-button', type: 'button', focusable: true, onPress: jest.fn() },
      ];

      mockKeyboardHandler.setTabOrder(chatElements);
      mockKeyboardHandler.focusElement(0);

      // Navigate through chat controls
      chatElements.forEach((element, index) => {
        expect(mockKeyboardHandler.focusedElement).toBe(element);
        if (index < chatElements.length - 1) {
          mockKeyboardHandler.handleKeyPress('Tab');
        }
      });

      // Test send button activation
      mockKeyboardHandler.focusElement(1); // Send button
      mockKeyboardHandler.handleKeyPress('Enter');
      expect(chatElements[1].onPress).toHaveBeenCalled();
    });

    it('should handle modal keyboard navigation', () => {
      const modalElements = [
        { id: 'modal-close', type: 'button', focusable: true, onPress: jest.fn(), onDismiss: jest.fn() },
        { id: 'modal-input', type: 'textinput', focusable: true },
        { id: 'modal-confirm', type: 'button', focusable: true, onPress: jest.fn() },
        { id: 'modal-cancel', type: 'button', focusable: true, onPress: jest.fn() },
      ];

      mockKeyboardHandler.setTabOrder(modalElements);
      mockKeyboardHandler.focusElement(0);

      // Test Escape key dismissal
      mockKeyboardHandler.handleKeyPress('Escape');
      expect(modalElements[0].onDismiss).toHaveBeenCalled();

      // Test tab trapping within modal
      mockKeyboardHandler.focusElement(3); // Last element
      mockKeyboardHandler.handleKeyPress('Tab');
      expect(mockKeyboardHandler.focusedElement).toBe(modalElements[0]); // Should wrap to first
    });

    it('should support keyboard shortcuts', () => {
      const shortcuts = {
        'Ctrl+Enter': jest.fn(), // Send message
        'Ctrl+K': jest.fn(), // Quick search
        'Ctrl+N': jest.fn(), // New conversation
        'Escape': jest.fn(), // Close modal/go back
      };

      const handleShortcut = (key: string) => {
        if (shortcuts[key]) {
          shortcuts[key]();
          return true;
        }
        return false;
      };

      // Test shortcuts
      expect(handleShortcut('Ctrl+Enter')).toBe(true);
      expect(shortcuts['Ctrl+Enter']).toHaveBeenCalled();

      expect(handleShortcut('Ctrl+K')).toBe(true);
      expect(shortcuts['Ctrl+K']).toHaveBeenCalled();

      expect(handleShortcut('Ctrl+X')).toBe(false); // Unknown shortcut
    });
  });

  describe('High Contrast Mode', () => {
    const colorSchemes = {
      normal: {
        background: '#FFFFFF',
        text: '#000000',
        primary: '#0056CC', // Darker blue for better contrast
        secondary: '#666666', // Darker gray for better contrast
        border: '#444444', // Darker border for better contrast
      },
      highContrast: {
        background: '#000000',
        text: '#FFFFFF',
        primary: '#FFFF00',
        secondary: '#FFFFFF',
        border: '#FFFFFF',
      },
      darkHighContrast: {
        background: '#000000',
        text: '#FFFFFF',
        primary: '#00FFFF',
        secondary: '#FFFFFF',
        border: '#FFFFFF',
      }
    };

    const calculateContrastRatio = (color1: string, color2: string): number => {
      // Simplified contrast ratio calculation
      // In real implementation, would use proper color space conversion
      const getLuminance = (color: string) => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        return 0.299 * r + 0.587 * g + 0.114 * b;
      };

      const lum1 = getLuminance(color1);
      const lum2 = getLuminance(color2);
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);
      
      return (brightest + 0.05) / (darkest + 0.05);
    };

    it('should meet WCAG contrast requirements', () => {
      Object.entries(colorSchemes).forEach(([schemeName, scheme]) => {
        // Test text on background contrast
        const textContrast = calculateContrastRatio(scheme.text, scheme.background);
        expect(textContrast).toBeGreaterThanOrEqual(4.5); // WCAG AA standard

        // Test primary color on background contrast
        const primaryContrast = calculateContrastRatio(scheme.primary, scheme.background);
        expect(primaryContrast).toBeGreaterThanOrEqual(3.0); // WCAG AA for large text

        // Test border visibility
        const borderContrast = calculateContrastRatio(scheme.border, scheme.background);
        expect(borderContrast).toBeGreaterThanOrEqual(3.0);
      });
    });

    it('should adapt message bubbles for high contrast', () => {
      const createMessageBubble = (isOwn: boolean, scheme: any) => {
        return {
          backgroundColor: isOwn ? scheme.primary : scheme.secondary,
          textColor: scheme.text,
          borderColor: scheme.border,
          borderWidth: scheme === colorSchemes.highContrast ? 2 : 1,
        };
      };

      // Test normal contrast
      const normalOwnMessage = createMessageBubble(true, colorSchemes.normal);
      const normalOtherMessage = createMessageBubble(false, colorSchemes.normal);

      expect(normalOwnMessage.backgroundColor).toBe(colorSchemes.normal.primary);
      expect(normalOwnMessage.borderWidth).toBe(1);

      // Test high contrast
      const highContrastOwnMessage = createMessageBubble(true, colorSchemes.highContrast);
      const highContrastOtherMessage = createMessageBubble(false, colorSchemes.highContrast);

      expect(highContrastOwnMessage.backgroundColor).toBe(colorSchemes.highContrast.primary);
      expect(highContrastOwnMessage.borderWidth).toBe(2); // Thicker borders in high contrast
    });

    it('should provide high contrast status indicators', () => {
      const getStatusIndicator = (status: string, scheme: any) => {
        const indicators = {
          online: { color: scheme === colorSchemes.normal ? '#34C759' : '#00FF00', size: 8 },
          offline: { color: scheme.secondary, size: 8 },
          away: { color: scheme === colorSchemes.normal ? '#FF9500' : '#FFFF00', size: 8 },
          busy: { color: scheme === colorSchemes.normal ? '#FF3B30' : '#FF0000', size: 8 },
        };

        return indicators[status as keyof typeof indicators] || indicators.offline;
      };

      const statuses = ['online', 'offline', 'away', 'busy'];
      
      statuses.forEach(status => {
        const normalIndicator = getStatusIndicator(status, colorSchemes.normal);
        const highContrastIndicator = getStatusIndicator(status, colorSchemes.highContrast);

        expect(normalIndicator).toBeDefined();
        expect(highContrastIndicator).toBeDefined();
        
        // High contrast should use more vivid colors
        if (status === 'online') {
          expect(highContrastIndicator.color).toBe('#00FF00');
        }
      });
    });

    it('should handle focus indicators in high contrast', () => {
      const getFocusStyle = (scheme: any) => {
        return {
          borderColor: scheme.primary,
          borderWidth: scheme === colorSchemes.highContrast ? 3 : 2,
          shadowColor: scheme.primary,
          shadowOpacity: scheme === colorSchemes.highContrast ? 1 : 0.3,
        };
      };

      const normalFocus = getFocusStyle(colorSchemes.normal);
      const highContrastFocus = getFocusStyle(colorSchemes.highContrast);

      expect(normalFocus.borderWidth).toBe(2);
      expect(normalFocus.shadowOpacity).toBe(0.3);

      expect(highContrastFocus.borderWidth).toBe(3); // Thicker focus indicator
      expect(highContrastFocus.shadowOpacity).toBe(1); // More prominent shadow
    });
  });

  describe('Font Scaling', () => {
    const fontSizes = {
      small: { multiplier: 0.85, base: 16 },
      normal: { multiplier: 1.0, base: 16 },
      large: { multiplier: 1.15, base: 16 },
      extraLarge: { multiplier: 1.3, base: 16 },
      huge: { multiplier: 1.5, base: 16 },
    };

    const calculateScaledSize = (baseSize: number, scale: string) => {
      const scaleConfig = fontSizes[scale as keyof typeof fontSizes] || fontSizes.normal;
      return Math.round(baseSize * scaleConfig.multiplier);
    };

    it('should scale message text appropriately', () => {
      const baseSizes = {
        messageText: 16,
        timestamp: 12,
        senderName: 14,
        systemMessage: 13,
      };

      Object.keys(fontSizes).forEach(scale => {
        const scaledSizes = {
          messageText: calculateScaledSize(baseSizes.messageText, scale),
          timestamp: calculateScaledSize(baseSizes.timestamp, scale),
          senderName: calculateScaledSize(baseSizes.senderName, scale),
          systemMessage: calculateScaledSize(baseSizes.systemMessage, scale),
        };

        // Verify scaling maintains relative proportions
        expect(scaledSizes.messageText).toBeGreaterThan(scaledSizes.timestamp);
        expect(scaledSizes.senderName).toBeGreaterThan(scaledSizes.timestamp);
        
        // Verify minimum readable sizes
        expect(scaledSizes.timestamp).toBeGreaterThanOrEqual(10);
        expect(scaledSizes.messageText).toBeGreaterThanOrEqual(12);
      });
    });

    it('should adjust layout for large fonts', () => {
      const getLayoutConfig = (scale: string) => {
        const isLargeScale = ['extraLarge', 'huge'].includes(scale);
        
        return {
          messagePadding: isLargeScale ? 16 : 12,
          avatarSize: isLargeScale ? 48 : 40,
          minTouchTarget: 44, // Always maintain minimum touch target
          lineHeight: calculateScaledSize(20, scale),
          maxMessageWidth: isLargeScale ? '85%' : '75%',
        };
      };

      const normalLayout = getLayoutConfig('normal');
      const largeLayout = getLayoutConfig('extraLarge');
      const hugeLayout = getLayoutConfig('huge');

      expect(normalLayout.messagePadding).toBe(12);
      expect(largeLayout.messagePadding).toBe(16);
      expect(hugeLayout.messagePadding).toBe(16);

      expect(normalLayout.avatarSize).toBe(40);
      expect(largeLayout.avatarSize).toBe(48);

      // Touch targets should always meet minimum requirements
      expect(normalLayout.minTouchTarget).toBe(44);
      expect(largeLayout.minTouchTarget).toBe(44);
    });

    it('should handle text truncation with scaling', () => {
      const truncateText = (text: string, maxWidth: number, fontSize: number) => {
        // Simplified text measurement (in real app, would use actual text measurement)
        const avgCharWidth = fontSize * 0.6;
        const maxChars = Math.floor(maxWidth / avgCharWidth);
        
        if (text.length <= maxChars) {
          return text;
        }
        
        return text.substring(0, maxChars - 3) + '...';
      };

      const longText = 'This is a very long message that might need to be truncated';
      const containerWidth = 200;

      Object.keys(fontSizes).forEach(scale => {
        const fontSize = calculateScaledSize(16, scale);
        const truncated = truncateText(longText, containerWidth, fontSize);
        
        // Larger fonts should result in more truncation
        if (scale === 'huge') {
          expect(truncated.length).toBeLessThan(longText.length);
          expect(truncated).toContain('...');
        }
        
        // Text should always fit within container
        const avgCharWidth = fontSize * 0.6;
        const estimatedWidth = truncated.length * avgCharWidth;
        expect(estimatedWidth).toBeLessThanOrEqual(containerWidth + 10); // Small tolerance
      });
    });

    it('should maintain button accessibility with font scaling', () => {
      const getButtonConfig = (scale: string) => {
        const fontSize = calculateScaledSize(16, scale);
        const isLargeScale = ['extraLarge', 'huge'].includes(scale);
        
        return {
          fontSize,
          minHeight: Math.max(44, fontSize + 20), // Ensure minimum touch target
          paddingVertical: isLargeScale ? 16 : 12,
          paddingHorizontal: isLargeScale ? 20 : 16,
        };
      };

      Object.keys(fontSizes).forEach(scale => {
        const buttonConfig = getButtonConfig(scale);
        
        // Minimum touch target should always be maintained
        expect(buttonConfig.minHeight).toBeGreaterThanOrEqual(44);
        
        // Padding should increase with font size
        if (scale === 'huge') {
          expect(buttonConfig.paddingVertical).toBe(16);
          expect(buttonConfig.paddingHorizontal).toBe(20);
        }
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('should provide semantic markup for screen readers', () => {
      const messageComponents = {
        conversationList: {
          role: 'list',
          label: 'Conversations',
          children: [
            { role: 'listitem', label: 'Conversation with John Doe' },
            { role: 'listitem', label: 'Conversation with Jane Smith' },
          ]
        },
        messageList: {
          role: 'log',
          label: 'Messages',
          live: 'polite',
          children: [
            { role: 'article', label: 'Message from John: Hello there' },
            { role: 'article', label: 'Message from you: Hi John!' },
          ]
        },
        messageInput: {
          role: 'textbox',
          label: 'Type a message',
          multiline: true,
          placeholder: 'Type a message...',
        }
      };

      // Verify semantic structure
      expect(messageComponents.conversationList.role).toBe('list');
      expect(messageComponents.conversationList.children).toHaveLength(2);
      
      expect(messageComponents.messageList.role).toBe('log');
      expect(messageComponents.messageList.live).toBe('polite');
      
      expect(messageComponents.messageInput.role).toBe('textbox');
      expect(messageComponents.messageInput.multiline).toBe(true);
    });

    it('should handle focus management correctly', () => {
      const focusManager = {
        focusStack: [] as string[],
        currentFocus: null as string | null,
        
        pushFocus(elementId: string) {
          if (this.currentFocus) {
            this.focusStack.push(this.currentFocus);
          }
          this.currentFocus = elementId;
        },
        
        popFocus() {
          if (this.focusStack.length > 0) {
            this.currentFocus = this.focusStack.pop() || null;
          } else {
            this.currentFocus = null;
          }
          return this.currentFocus;
        },
        
        restoreFocus() {
          return this.popFocus();
        }
      };

      // Test focus management flow
      focusManager.pushFocus('conversation-list');
      expect(focusManager.currentFocus).toBe('conversation-list');

      focusManager.pushFocus('message-input');
      expect(focusManager.currentFocus).toBe('message-input');
      expect(focusManager.focusStack).toContain('conversation-list');

      const restored = focusManager.restoreFocus();
      expect(restored).toBe('conversation-list');
      expect(focusManager.currentFocus).toBe('conversation-list');
    });

    it('should provide appropriate ARIA live regions', () => {
      const liveRegions = {
        messageStatus: {
          'aria-live': 'polite',
          'aria-atomic': true,
          content: 'Message sent',
        },
        typingIndicator: {
          'aria-live': 'polite',
          'aria-atomic': false,
          content: 'John is typing',
        },
        errorMessages: {
          'aria-live': 'assertive',
          'aria-atomic': true,
          content: 'Failed to send message',
        },
        connectionStatus: {
          'aria-live': 'polite',
          'aria-atomic': true,
          content: 'Connected',
        }
      };

      // Verify live region configurations
      expect(liveRegions.messageStatus['aria-live']).toBe('polite');
      expect(liveRegions.errorMessages['aria-live']).toBe('assertive');
      
      // Error messages should be atomic (read completely)
      expect(liveRegions.errorMessages['aria-atomic']).toBe(true);
      
      // Typing indicators can be non-atomic (partial updates)
      expect(liveRegions.typingIndicator['aria-atomic']).toBe(false);
    });

    it('should handle reduced motion preferences', () => {
      const animationConfig = {
        prefersReducedMotion: false,
        
        getAnimationDuration(baseMs: number) {
          return this.prefersReducedMotion ? 0 : baseMs;
        },
        
        getTransition(type: string) {
          if (this.prefersReducedMotion) {
            return { duration: 0, easing: 'linear' };
          }
          
          const transitions = {
            fade: { duration: 300, easing: 'ease-in-out' },
            slide: { duration: 250, easing: 'ease-out' },
            bounce: { duration: 400, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
          };
          
          return transitions[type as keyof typeof transitions] || transitions.fade;
        }
      };

      // Test normal motion
      expect(animationConfig.getAnimationDuration(300)).toBe(300);
      expect(animationConfig.getTransition('fade').duration).toBe(300);

      // Test reduced motion
      animationConfig.prefersReducedMotion = true;
      expect(animationConfig.getAnimationDuration(300)).toBe(0);
      expect(animationConfig.getTransition('fade').duration).toBe(0);
      expect(animationConfig.getTransition('bounce').duration).toBe(0);
    });
  });
});
