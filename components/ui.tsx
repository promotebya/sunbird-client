import React from 'react';
import { Text, View, ViewProps } from 'react-native';

export const s = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const Card = ({ style, children }: { style?: any; children: React.ReactNode }) => (
  <View
    style={[
      {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 2,
      },
      style,
    ]}
  >
    {children}
  </View>
);

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: s.sm, color: '#0F172A' }}>{children}</Text>
);

export const Title = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '700', color: '#0F172A' }}>{children}</Text>
);

export const Subtitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>{children}</Text>
);

export const Row = (props: ViewProps) => <View {...props} style={[{ flexDirection: 'row', alignItems: 'center' }, props.style]} />;

export const EmptyState = ({
  title,
  body,
  cta,
}: {
  title: string;
  body?: string;
  cta?: React.ReactNode;
}) => (
  <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
    <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 6 }}>{title}</Text>
    {body ? <Text style={{ textAlign: 'center', color: '#64748B', marginBottom: 12 }}>{body}</Text> : null}
    {cta}
  </Card>
);
