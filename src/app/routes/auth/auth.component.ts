import { Component } from "@angular/core";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { UserService } from "@core/services";
import { ToastService } from "@core/services/toast/toast.service";

interface LoginForm {
  nickname: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  public userForm: FormGroup<LoginForm>;
  public isLoading: boolean;

  constructor(private user: UserService, private router: Router, private toast: ToastService) {
    this.isLoading = false;
    this.userForm = new FormGroup<LoginForm>(
      {
        nickname: new FormControl("", {
          validators: Validators.required,
          nonNullable: true,
        }),
        password: new FormControl("", {
          validators: Validators.required,
          nonNullable: true,
        }),
      },
      AuthComponent.validLogin
    );
  }

  private static validLogin({ get }: AbstractControl): ValidationErrors | null {
    const nickname = get("nickname");
    const password = get("password");
    if (!nickname || !password) return null;
    return { isRequired: true };
  }

  public onSubmit(): void {
    if (!this.userForm.valid) return;
    const params = this.userForm.getRawValue();

    this.isLoading = true;
    this.user.login(params).subscribe({
      next: ({ token }) => {
        this.userForm.reset();
        this.user.setToken(token);
        this.user.update().subscribe({
          next: (info) => {
            this.user.info = info;
          },
          error: () => {
            this.toast.show('Login', 'danger');
            this.isLoading = false;
            this.user.destroy();
          }
        });
        this.router.navigateByUrl('/home');
      },
      error: () => {
        this.toast.show('Login', 'danger');
        this.isLoading = false;
      }
    })
  }
}
