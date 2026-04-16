from faker import Faker
import random
import psycopg2

fake = Faker()

# 🔗 DB CONNECT
conn = psycopg2.connect(
    host="localhost",
    database="your_db_name",
    user="your_user",
    password="your_password"
)

cur = conn.cursor()

# -------------------------------
# 👨‍⚕️ DOCTORS (20)
# -------------------------------
for _ in range(20):
    cur.execute(
        """
        INSERT INTO doctors (name, email, phone, specialization)
        VALUES (%s, %s, %s, %s)
        """,
        (
            fake.name(),
            fake.email(),
            fake.phone_number(),
            random.choice(["Cardiology", "Neurology", "Orthopedic"])
        )
    )

# -------------------------------
# 👩‍⚕️ NURSES (40)
# -------------------------------
for _ in range(40):
    cur.execute(
        """
        INSERT INTO nurses (name, email, phone, department)
        VALUES (%s, %s, %s, %s)
        """,
        (
            fake.name(),
            fake.email(),
            fake.phone_number(),
            random.choice(["ICU", "General Ward", "Emergency"])
        )
    )

# -------------------------------
# 🧑‍ بیمار PATIENTS (100)
# -------------------------------
for _ in range(100):
    cur.execute(
        """
        INSERT INTO patients (name, age, gender, condition)
        VALUES (%s, %s, %s, %s)
        """,
        (
            fake.name(),
            random.randint(1, 90),
            random.choice(["Male", "Female"]),
            random.choice(["Stable", "Critical", "Under Observation"])
        )
    )

conn.commit()
cur.close()
conn.close()

print("✅ Data inserted successfully!")