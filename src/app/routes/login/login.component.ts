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
  selector: "app-login",
  imports: [ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
})
export class LoginComponent {
  public userForm: FormGroup<LoginForm>;

  constructor(private user: UserService, private router: Router, private toast: ToastService) {
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
      LoginComponent.validLogin
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
    this.user.login(params).subscribe({
      next: ({ token }) => {
        this.userForm.reset();
        this.user.setToken(token);
        this.user.update();
        this.router.navigateByUrl('/home');
      },
      error: () => {
        this.toast.show('Login', 'danger')
      }
    })
  }
}
