import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCurrencyBRL } from '../../utils/format';
import { useAppTheme } from '../../contexts/themeContext';
import { spacing, borderRadius, getShadow } from '../../theme';

interface Account { 
  id?: string;
  name: string; 
  type: string; 
  balance: number;
  icon?: string;
}

interface Props { 
  balance?: number; 
  accounts?: Account[];
  onAccountPress?: (account: Account) => void;
  onAddPress?: () => void;
}

// Get avatar background color based on account name
const getAvatarColor = (name: string): string => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export default function BalanceCard({ balance = 0, accounts = [], onAccountPress, onAddPress }: Props) {
  const { colors } = useAppTheme();

  // Account item component
  const AccountRow = ({ account }: { account: Account }) => {
    const avatarColor = getAvatarColor(account.name);
    const initial = account.name.charAt(0).toUpperCase();
    
    return (
      <Pressable 
        onPress={() => onAccountPress?.(account)}
        style={({ pressed }) => [
          styles.accountRow,
          { backgroundColor: pressed ? colors.grayLight : 'transparent' }
        ]}
      >
        <View style={[styles.accountAvatar, { backgroundColor: `${avatarColor}15` }]}>
          <Text style={[styles.accountInitial, { color: avatarColor }]}>{initial}</Text>
        </View>
        
        <View style={styles.accountInfo}>
            <Text variant="bodyMedium" style={[styles.accountName, { color: colors.text }]}>{account.name}</Text>
            <Text variant="bodySmall" style={[styles.accountType, { color: colors.textMuted }]}>{account.type}</Text>
            {account.balance < 0 && (
              <View style={[styles.accountWarningTag, { backgroundColor: colors.danger }]}> 
                <Text variant="bodySmall" style={[styles.accountWarningText, { color: colors.textInverse }]}>Usando limite da conta</Text>
              </View>
            )}
        </View>
        
        <Text variant="titleSmall" style={[styles.accountBalance, { color: colors.text }]}>
          {formatCurrencyBRL(account.balance)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, getShadow(colors)]}>
      {/* Header with total balance */}
      <View style={styles.header}>
        <View style={styles.balanceSection}>
          <Text variant="labelMedium" style={[styles.balanceLabel, { color: colors.textMuted }]}>Saldo em contas</Text>
          <Text variant="headlineMedium" style={[styles.balanceValue, { color: colors.text }]}>
            {formatCurrencyBRL(balance)}
          </Text>
        </View>
        
        <Pressable 
          onPress={onAddPress}
          style={({ pressed }) => [
            styles.balanceIcon, 
            { backgroundColor: colors.primaryBg },
            pressed && { opacity: 0.7 }
          ]}
        >
          <MaterialCommunityIcons 
            name={accounts.length > 0 ? "wallet-outline" : "plus"} 
            size={24} 
            color={colors.primary} 
          />
        </Pressable>
      </View>

      {/* Accounts section */}
      {accounts.length > 0 ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <Text variant="labelMedium" style={[styles.sectionTitle, { color: colors.textMuted }]}>Minhas contas</Text>
          
          <View style={styles.accountsList}>
            {accounts.map((account, index) => (
              <AccountRow key={index} account={account} />
            ))}
          </View>
        </>
      ) : (
        <Pressable 
          onPress={onAddPress}
          style={({ pressed }) => [
            styles.emptyContainer, 
            { backgroundColor: colors.grayLight },
            pressed && { opacity: 0.7 }
          ]}
        >
          <MaterialCommunityIcons
            name="wallet-plus-outline"
            size={40}
            color={colors.primary}
          />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Adicionar conta
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceSection: {
    flex: 1,
  },
  balanceLabel: {
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  balanceValue: {
    fontWeight: '700',
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    fontWeight: '500',
  },
  accountsList: {
    gap: spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInitial: {
    fontSize: 18,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  accountName: {
    fontWeight: '600',
  },
  accountType: {
    marginTop: 2,
  },
  accountWarningTag: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  accountWarningText: {
    fontSize: 12,
    fontWeight: '600',
  },
  accountBalance: {
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: 14,
  },
});
