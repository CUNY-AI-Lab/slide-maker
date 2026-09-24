# Handoff completion plan

1. Combine #14 and documentation #13 against canonical main; retain the
   existing product architecture and account ownership.
2. Verify the current actual Gateway receiver and correct refusal metadata and
   readiness configuration; make no Gateway implementation changes.
3. Add snapshot/restore tooling and rehearse it with real disposable SQLite,
   uploads and additive identity migrations.
4. Extend mounted browser acceptance through actual ZIP inspection and add
   that scenario to CI. Run the complete source checks and push a reviewable PR.
5. Establish the supported private CI connection, exact-source serialized
   release and production backup rehearsal before deployed sign-in, model,
   role/sharing and export acceptance. Never restore old data automatically.
