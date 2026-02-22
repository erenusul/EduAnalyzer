using EduAnalyzer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduAnalyzer.Infrastructure.Data;

/// <summary>
/// Ana veritabanı context - Tüm entity'ler için DbSet ve ilişki konfigürasyonları.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Teacher> Teachers => Set<Teacher>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Class> Classes => Set<Class>();
    public DbSet<Parent> Parents => Set<Parent>();
    public DbSet<StudentParent> StudentParents => Set<StudentParent>();
    public DbSet<AnalysisRecord> AnalysisRecords => Set<AnalysisRecord>();
    public DbSet<Exam> Exams => Set<Exam>();
    public DbSet<ExamResult> ExamResults => Set<ExamResult>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.DisplayName).HasMaxLength(200);
        });

        modelBuilder.Entity<Teacher>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.User).WithOne(x => x.Teacher).HasForeignKey<Teacher>(x => x.UserId);
        });

        modelBuilder.Entity<Student>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TeacherId, x.StudentNo }).IsUnique();
            e.Property(x => x.StudentNo).HasMaxLength(50);
            e.Property(x => x.FirstName).HasMaxLength(100);
            e.Property(x => x.LastName).HasMaxLength(100);
            e.HasOne(x => x.Class).WithMany(c => c.Students).HasForeignKey(x => x.ClassId);
            e.HasOne(x => x.Teacher).WithMany().HasForeignKey(x => x.TeacherId);
            e.HasOne(x => x.User).WithOne(x => x.Student).HasForeignKey<Student>(x => x.UserId);
        });

        modelBuilder.Entity<Class>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(50);
            e.Property(x => x.Grade).HasMaxLength(20);
            e.Property(x => x.AcademicYear).HasMaxLength(20);
            e.HasOne(x => x.Teacher).WithMany(t => t.Classes).HasForeignKey(x => x.TeacherId);
        });

        modelBuilder.Entity<Parent>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.User).WithOne(x => x.Parent).HasForeignKey<Parent>(x => x.UserId);
        });

        modelBuilder.Entity<StudentParent>(e =>
        {
            e.HasKey(x => new { x.StudentId, x.ParentId });
            e.HasOne(x => x.Student).WithMany(s => s.StudentParents).HasForeignKey(x => x.StudentId);
            e.HasOne(x => x.Parent).WithMany(p => p.StudentParents).HasForeignKey(x => x.ParentId);
        });

        modelBuilder.Entity<AnalysisRecord>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(500);
            e.Property(x => x.FileName).HasMaxLength(500);
            e.HasOne(x => x.Teacher).WithMany(t => t.Analyses).HasForeignKey(x => x.TeacherId);
            e.HasOne(x => x.Exam).WithOne(ex => ex.Analysis).HasForeignKey<Exam>(ex => ex.AnalysisId);
        });

        modelBuilder.Entity<Exam>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(500);
            e.Property(x => x.WeekLabel).HasMaxLength(20);
            e.HasOne(x => x.Analysis).WithOne(a => a.Exam).HasForeignKey<Exam>(x => x.AnalysisId);
            e.HasOne(x => x.Teacher).WithMany().HasForeignKey(x => x.TeacherId);
        });

        modelBuilder.Entity<ExamResult>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.StudentId, x.ExamId }).IsUnique();
            e.HasOne(x => x.Student).WithMany(s => s.ExamResults).HasForeignKey(x => x.StudentId);
            e.HasOne(x => x.Exam).WithMany(ex => ex.ExamResults).HasForeignKey(x => x.ExamId);
        });
    }
}
