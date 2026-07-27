-- Seeds the first admin user, matching the Cognito user created for the
-- initial end-to-end login test (see aws-migration-plan memory).
-- Cognito sub: 84c81478-6001-7067-9356-39d7e27ca2b5

INSERT INTO users (id, email)
VALUES ('84c81478-6001-7067-9356-39d7e27ca2b5', 'j.jamjoom@cedge.com.sa');

INSERT INTO profiles (user_id, email, full_name)
VALUES ('84c81478-6001-7067-9356-39d7e27ca2b5', 'j.jamjoom@cedge.com.sa', 'J. Jamjoom');

INSERT INTO user_roles (user_id, role)
VALUES ('84c81478-6001-7067-9356-39d7e27ca2b5', 'super_admin');
