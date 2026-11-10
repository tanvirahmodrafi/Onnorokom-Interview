using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public const string OneActivePerStudentIndex = "ux_holds_one_active_per_student";

    public DbSet<SchoolClass> Classes => Set<SchoolClass>();
    public DbSet<Hold> Holds => Set<Hold>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SchoolClass>(e =>
        {
            e.ToTable("classes", t => t.HasCheckConstraint("ck_classes_total_seats_positive", "total_seats > 0"));
            e.Property(c => c.Name).HasMaxLength(200);
            e.Property(c => c.NormalizedName).HasMaxLength(200);
            e.HasIndex(c => c.NormalizedName).IsUnique();
        });

        modelBuilder.Entity<Hold>(e =>
        {
            e.ToTable("holds");
            e.Property(h => h.StudentId).HasMaxLength(17);
            e.Property(h => h.StudentName).HasMaxLength(100);
            e.Property(h => h.ContactNumber).HasMaxLength(16);
            // Stored as 'HELD', 'CONFIRMED', ... so the partial index below reads naturally.
            e.Property(h => h.Status)
                .HasMaxLength(16)
                .HasConversion(v => v.ToString().ToUpperInvariant(), v => Enum.Parse<HoldStatus>(v, true));

            e.HasOne(h => h.Class).WithMany(c => c.Holds).HasForeignKey(h => h.ClassId);

            // Enforced by the database: a student has at most one live application or admission,
            // across all classes (one student studies in one class). This also covers rule 3.
            e.HasIndex(h => h.StudentId, OneActivePerStudentIndex)
                .IsUnique()
                .HasFilter("status IN ('HELD', 'CONFIRMED')")
                .HasDatabaseName(OneActivePerStudentIndex);

            e.HasIndex(h => new { h.ClassId, h.Status });
            // Named, because a second index on the same column would otherwise merge with the one above.
            e.HasIndex(h => h.StudentId, "ix_holds_student_id").HasDatabaseName("ix_holds_student_id");
            e.HasIndex(h => h.ExpiresAt).HasFilter("status = 'HELD'");
        });
    }
}
