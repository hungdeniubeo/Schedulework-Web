# ScheduleWork final QA

Use a disposable test employee and week. Never run destructive checks against
production history.

## Admin

- [ ] Login, rejected password, logout, session reload, and guarded `/admin`
- [ ] Create employee; temporary password appears once; forced password change
- [ ] Reset password; old password is rejected; forced password change repeats
- [ ] Deactivate/reactivate employee without losing history
- [ ] Rename and reorder employee; assign/remove group and position; toggle `Nhân viên mới`
- [ ] Create/rename/reorder/delete position; assigned position deletion is rejected
- [ ] Create/rename/reorder/delete group; assigned group deletion is rejected
- [ ] Create/edit/delete shift; used shift deletion is rejected
- [ ] Create Monday registration week; edit deadline; lock/re-open/archive
- [ ] Registration matrix shows preset, exact hours, split Full, Nghỉ, and note
- [ ] Scheduler matches availability by `week_start` and shows `ĐK · …` separately
- [ ] Create/edit/drag/delete/clear non-overlapping official shifts
- [ ] Draft remains private; publish exposes My Schedule and Team Schedule
- [ ] JPG contains official schedule, positions, groups, colors, and no `ĐK` hints

## Employee

- [ ] Login, forced password change, logout, and inactive access rejection
- [ ] Submit all five presets and Nghỉ; adjust hour-only values and Full split
- [ ] First save and update show the correct success message and persisted time
- [ ] Reload restores submission; locked week is read-only
- [ ] My Schedule shows submitted availability before publish
- [ ] My Schedule shows official schedule first after publish, registration second
- [ ] Team Schedule shows only published official data and current positions

## Responsive

- [ ] Employee flow at 360 × 800
- [ ] Employee flow at 390 × 844
- [ ] Employee flow at 412 × 915
- [ ] No page overflow, clipped controls, hidden sticky Save, or double submit
- [ ] Admin scheduler at 1366 × 768, 1440 × 900, and 1920 × 1080
- [ ] Long names, positions, weekday columns, hints, chips, and S/T/Đ stay aligned
