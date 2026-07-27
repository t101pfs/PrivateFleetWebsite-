-- Seeds odai@privatefleetservices.com, matching the Cognito user created
-- for their first AWS login.
-- Cognito sub: 1428d4d8-6051-70a1-f8d7-63e95231cacd

INSERT INTO users (id, email)
VALUES ('1428d4d8-6051-70a1-f8d7-63e95231cacd', 'odai@privatefleetservices.com');

INSERT INTO profiles (user_id, email, full_name)
VALUES ('1428d4d8-6051-70a1-f8d7-63e95231cacd', 'odai@privatefleetservices.com', 'Odai');

INSERT INTO user_roles (user_id, role)
VALUES ('1428d4d8-6051-70a1-f8d7-63e95231cacd', 'super_admin');
