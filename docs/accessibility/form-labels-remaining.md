# Form labels still to associate (#540)

The create and edit payment link forms are done. These forms still have labels that are not
tied to their inputs, found with a search for `<label` without `htmlFor`:

- `src/app/dashboard/settings/page.tsx`: Email
- `src/app/dashboard/wallets/new/NewWalletClient.tsx`: wallet name, description, password fields
- `src/app/dashboard/wallets/[id]/api/page.tsx`, `assets/page.tsx`, `sponsorship/page.tsx`,
  `whitelist/page.tsx`
- `src/components/addresses/CustomerReferenceField.tsx`
- `src/components/auth/ForgotPasswordForm.tsx`
- `src/components/settings/ChangePasswordForm.tsx`
- `src/components/wallets/ChangeWalletPasswordModal.tsx`, `EditWalletDetails.tsx`,
  `RecoverWalletModal.tsx`, `WalletModals.tsx`

Labels that wrap their input are already associated and are not listed.
